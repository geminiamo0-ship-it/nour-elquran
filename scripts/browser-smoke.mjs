import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'apps/web');
assert(fs.existsSync(path.join(web, '.next/BUILD_ID')), 'Production build required before browser smoke');

const port = 32000 + Math.floor(Math.random() * 8000);
const url = 'http://127.0.0.1:' + port + '/';
const screenshots = path.join(root, 'artifacts/browser-smoke');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'noor-chrome-'));
const children = [];
let socket;

function launch(command, args, options = {}) {
  const child = spawn(command, args, { stdio: 'ignore', ...options });
  children.push(child);
  return child;
}

async function waitFor(check, description) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    let value;
    try { value = await check(); } catch { /* still loading */ }
    if (value) return value;
    await sleep(250);
  }
  throw new Error('Timed out waiting for ' + description);
}

async function connect(targetUrl) {
  const ws = new globalThis.WebSocket(targetUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  });
  return {
    close: () => ws.close(),
    send: (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    }),
  };
}

try {
  const server = launch('node', [path.join(web, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port)], {
    cwd: web,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  });
  await waitFor(async () => {
    if (server.exitCode !== null) throw new Error('Next exited: ' + server.exitCode);
    return (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok;
  }, 'Next production server');

  const browser = launch(process.env.CHROME_BIN || 'google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--no-proxy-server', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
    '--remote-allow-origins=*', '--user-data-dir=' + profile,
  ]);
  const debugPort = await waitFor(() => {
    if (browser.exitCode !== null) throw new Error('Chrome exited: ' + browser.exitCode);
    const file = path.join(profile, 'DevToolsActivePort');
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n')[0] : null;
  }, 'Chrome DevTools port');
  const targetResponse = await fetch(
    'http://127.0.0.1:' + debugPort + '/json/new?' + encodeURIComponent(url),
    { method: 'PUT' },
  );
  assert(targetResponse.ok, 'Chrome target creation failed');
  const target = await targetResponse.json();
  assert(target.webSocketDebuggerUrl, 'Chrome target WebSocket missing');
  socket = await connect(target.webSocketDebuggerUrl);
  await socket.send('Page.enable');
  await socket.send('Runtime.enable');
  fs.mkdirSync(screenshots, { recursive: true });

  for (const width of [360, 390, 1440]) {
    await socket.send('Emulation.setDeviceMetricsOverride', {
      width, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    await socket.send('Page.navigate', { url });
    const rendered = await waitFor(async () => {
      const evaluated = await socket.send('Runtime.evaluate', {
        expression: "(() => ({ready: document.readyState, url: location.href, lang: document.documentElement?.lang, dir: document.documentElement?.dir, width: innerWidth, scrollWidth: document.documentElement?.scrollWidth, title: document.querySelector('h1')?.textContent || '', demo: document.body?.textContent.includes('نسخة تجريبية')}))()",
        returnByValue: true,
      });
      const value = evaluated.result?.value;
      return value?.ready === 'complete' && value?.url === url && value?.title ? value : null;
    }, 'Arabic page at ' + width + 'px');
    assert.equal(rendered.lang, 'ar');
    assert.equal(rendered.dir, 'rtl');
    assert.equal(rendered.width, width, 'Viewport mismatch');
    assert(rendered.scrollWidth <= width, 'Horizontal overflow at ' + width + 'px');
    assert(rendered.title.includes('القرآن'), 'Arabic heading missing');
    assert(rendered.demo, 'Foundation-only disclosure missing');
    const capture = await socket.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: false,
    });
    const png = Buffer.from(capture.data, 'base64');
    assert.equal(png.readUInt32BE(16), width, 'Screenshot width mismatch');
    fs.writeFileSync(path.join(screenshots, 'foundation-' + width + '.png'), png);
    console.log('Chrome browser smoke passed: ' + width + 'px, RTL, no overflow');
  }
} finally {
  socket?.close();
  for (const child of children.reverse()) child.kill('SIGTERM');
  await sleep(500);
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
