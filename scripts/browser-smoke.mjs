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

async function waitFor(check, description, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
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

  const debugPort = 40000 + Math.floor(Math.random() * 10000);
  const browser = launch(process.env.CHROME_BIN || 'google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--no-proxy-server', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking',
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=' + debugPort,
    '--remote-allow-origins=*', '--user-data-dir=' + profile,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let browserErrors = '';
  browser.stderr.on('data', chunk => { browserErrors += chunk.toString().slice(-2000); });
  try {
    await waitFor(async () => {
      if (browser.exitCode !== null) throw new Error('Chrome exited: ' + browser.exitCode);
      const response = await fetch('http://127.0.0.1:' + debugPort + '/json/version', {
        signal: AbortSignal.timeout(1000),
      });
      return response.ok;
    }, 'Chrome DevTools HTTP endpoint', 240);
  } catch (error) {
    throw new Error(error.message + '; Chrome exit=' + browser.exitCode +
      '; stderr=' + browserErrors.slice(-3000));
  }
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
        expression: "(() => ({ready: document.readyState, url: location.href, lang: document.documentElement?.lang, dir: document.documentElement?.dir, width: innerWidth, scrollWidth: document.documentElement?.scrollWidth, title: document.querySelector('h1')?.textContent || '', demo: document.body?.textContent.includes('صفحة تجريبية')}))()",
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
    assert(rendered.demo, 'Approved landing demo disclosure missing');
    const capture = await socket.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: false,
    });
    const png = Buffer.from(capture.data, 'base64');
    assert.equal(png.readUInt32BE(16), width, 'Screenshot width mismatch');
    fs.writeFileSync(path.join(screenshots, 'foundation-' + width + '.png'), png);
    console.log('Chrome browser smoke passed: ' + width + 'px, RTL, no overflow');
  }

  // Exercise real React hydration rather than inspecting inert server HTML.
  await waitFor(async () => {
    const response = await socket.send('Runtime.evaluate', {
      expression: "Object.keys(document.querySelector('#menuBtn') || {}).some(key => key.includes('reactProps'))",
      returnByValue: true,
    });
    return response.result?.value === true;
  }, 'React hydration');

  const interaction = await socket.send('Runtime.evaluate', {
    expression: `(async () => {
      const pause = () => new Promise(resolve => setTimeout(resolve, 80));
      const menu = document.querySelector('#menuBtn');
      menu.click(); await pause();
      const menuOpened = document.querySelector('#siteNav').classList.contains('open');
      document.querySelector('#siteNav a[href="#about"]').click(); await pause();
      const menuClosed = !document.querySelector('#siteNav').classList.contains('open');

      document.querySelector('[data-tool="highlight"]').click();
      const ayah = document.querySelector('.ayah');
      ayah.click(); await pause();
      const highlighted = ayah.classList.contains('marked');
      document.querySelector('[data-tool="clear"]').click(); await pause();
      const cleared = !ayah.classList.contains('marked');

      document.querySelector('#addSiblingBtn').click(); await pause();
      const sibling = document.querySelector('#siblingList input[name="siblings"]');
      const siblingAdded = Boolean(sibling);
      sibling.value = 'طالب ثان';
      document.querySelector('#accountName').value = 'حساب تجريبي';
      document.querySelector('#parentPhone').value = '01012345678';
      document.querySelector('#learnerName').value = 'طالب أول';
      document.querySelector('#learnerLevel').value = 'يبدأ من الصفر';
      const form = document.querySelector('#registrationForm');
      const formValid = form.checkValidity();
      form.requestSubmit(); await pause();
      const modalOpened = document.querySelector('#dashboardModal').classList.contains('open');
      const twoLearners = document.querySelectorAll('#createdProfiles button').length === 2;
      document.querySelector('#modalTabs [data-tab="classes"]').click(); await pause();
      document.querySelector('#mockSlots [data-slot]').click(); await pause();
      const booked = document.querySelector('#bookingStatus').textContent.includes('موعد محفوظ للعرض فقط');
      document.querySelector('#closeModal').click(); await pause();
      const modalClosed = !document.querySelector('#dashboardModal').classList.contains('open');
      return { menuOpened, menuClosed, highlighted, cleared, siblingAdded, formValid,
        modalOpened, twoLearners, booked, modalClosed };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  const checks = interaction.result?.value;
  assert(checks && Object.values(checks).every(Boolean),
    'Native React interaction smoke failed: ' + JSON.stringify(checks ?? interaction));
  console.log('Native React interaction smoke passed: nav, ayah, sibling profiles, booking and modal');


  // M2 student portal smoke: persisted in-tab mock onboarding + sibling isolation.
  for (const width of [360, 390, 1440]) {
    await socket.send('Emulation.setDeviceMetricsOverride', {
      width, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    await socket.send('Page.navigate', { url: url + 'student' });
    await waitFor(async () => {
      const result = await socket.send('Runtime.evaluate', {
        expression: "document.getElementById('learner-switch')?.options.length >= 5",
        returnByValue: true,
      });
      return result.result?.value === true;
    }, 'student portal hydrated with onboarding profiles');
    const result = await socket.send('Runtime.evaluate', {
      expression: "(async () => {\n  const pause = () => new Promise(r => setTimeout(r, 120));\n  const switcher = document.getElementById('learner-switch');\n  const handoff = switcher && Array.from(switcher.options).some(o => o.textContent.includes('طالب أول'));\n  switcher.value = 'demo-active';\n  switcher.dispatchEvent(new Event('change', { bubbles: true }));\n  await pause();\n  const active = document.querySelector('#student-main')?.textContent.includes('مراجعة سورة الإخلاص');\n  const report = document.querySelector('#student-main')?.textContent.includes('8 / 10');\n  switcher.value = 'demo-new';\n  switcher.dispatchEvent(new Event('change', { bubbles: true }));\n  await pause();\n  const isolated = !document.querySelector('#student-main')?.textContent.includes('8 / 10');\n  const noFakeGrades = document.querySelector('#student-main')?.textContent.includes('لم يُنشَر أي تقرير');\n  return { handoff, active, report, isolated, noFakeGrades };\n})()",
      awaitPromise: true,
      returnByValue: true,
    });
    const actual = result.result?.value;
    assert(actual && Object.values(actual).every(Boolean),
      'Student portal profile switching: ' + JSON.stringify(actual ?? result));
    const layout = await socket.send('Runtime.evaluate', {
      expression: "({width: innerWidth, scrollWidth: document.documentElement.scrollWidth, dir: document.documentElement.dir})",
      returnByValue: true,
    });
    assert.equal(layout.result?.value?.dir, 'rtl');
    assert(layout.result?.value?.scrollWidth <= width, 'Student horizontal overflow at ' + width);
    const screen = await socket.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(screenshots, 'student-' + width + '.png'), Buffer.from(screen.data, 'base64'));
    console.log('Student portal Chrome smoke passed: ' + width + 'px, profile isolation and account handoff');
  }


  // Additional learner routes must be actual Next.js pages, not inert dashboard placeholders.
  for (const [section, expected] of [
    ['lessons', 'سجل الحصص'], ['training', 'التحضير قبل التسميع'],
    ['progress', 'السجل الأكاديمي'], ['notebook', 'دفتر الطالب الخاص'],
    ['subscription', 'ملخص الاشتراك'], ['account', 'ملفات الطلاب'],
    ['mushaf', 'معاينة المصحف'],
  ]) {
    const response = await fetch(url + 'student/' + section, { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200, 'Student route did not render: ' + section);
    const markup = await response.text();
    assert(markup.includes(expected), 'Student section missing: ' + section);
  }
  console.log('Student portal subroute HTTP smoke passed: 7 feature pages');

  await socket.send('Page.navigate', { url: url + 'student/mushaf' });
  await waitFor(async () => {
    const result = await socket.send('Runtime.evaluate', {
      expression: "document.querySelector('[aria-label=\"نص قرآني توضيحي من معاينة التصميم\"] button') && Object.keys(document.querySelector('[aria-label=\"نص قرآني توضيحي من معاينة التصميم\"] button')).some(k => k.includes('reactProps'))",
      returnByValue: true,
    });
    return Boolean(result.result?.value);
  }, 'hydrated learner Mushaf');
  const mushafResult = await socket.send('Runtime.evaluate', {
    expression: "(async () => {\n  await new Promise(resolve => setTimeout(resolve, 250));\n  const ayah = document.querySelector('[aria-label=\"نص قرآني توضيحي من معاينة التصميم\"] button');\n  if (!ayah) return { ayahFound: false };\n  ayah.click();\n  await new Promise(resolve => setTimeout(resolve, 120));\n  const highlighted = ayah.getAttribute('aria-pressed') === 'true';\n  const note = document.querySelector('#mushaf-note');\n  const editable = Boolean(note);\n  const reset = [...document.querySelectorAll('button')].find(button => button.textContent.includes('مسح العلامات'));\n  reset?.click();\n  await new Promise(resolve => setTimeout(resolve, 120));\n  const cleared = ayah.getAttribute('aria-pressed') === 'false';\n  return { ayahFound: true, highlighted, editable, cleared };\n})()", awaitPromise: true, returnByValue: true,
  });
  const values = mushafResult.result?.value;
  assert(values && Object.values(values).every(Boolean), 'Mushaf interactions failed: ' + JSON.stringify(values ?? mushafResult));
  console.log('Student Mushaf interactive highlight, notes and clear smoke passed');

} finally {
  socket?.close();
  for (const child of children.reverse()) child.kill('SIGTERM');
  await sleep(500);
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
