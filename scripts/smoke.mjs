import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'apps/web');
assert(fs.existsSync(path.join(web, '.next/BUILD_ID')), 'Production build must exist before smoke');

const port = String(32000 + Math.floor(Math.random() * 8000));
const child = spawn('node', [path.join(web, 'node_modules/next/dist/bin/next'), 'start', '-p', port], {
  cwd: web,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PORT: port, NEXT_TELEMETRY_DISABLED: '1' },
});
let logs = '';
child.stdout.on('data', chunk => { logs += chunk.toString(); });
child.stderr.on('data', chunk => { logs += chunk.toString(); });

try {
  let html = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) throw new Error('Next server exited prematurely: ' + logs);
    try {
      const response = await fetch('http://127.0.0.1:' + port, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { html = await response.text(); break; }
    } catch { /* server not ready */ }
    await sleep(500);
  }
  assert(html, 'Next server did not become ready: ' + logs);
  for (const required of ['lang="ar"', 'dir="rtl"', 'نور القرآن', 'صفحة تجريبية']) {
    assert(html.includes(required), 'Missing rendered value: ' + required);
  }
  console.log('Production HTTP smoke OK (Arabic/RTL, real Next server)');
} finally {
  child.kill('SIGTERM');
}
