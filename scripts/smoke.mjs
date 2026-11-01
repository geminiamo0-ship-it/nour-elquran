import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'apps/web');
assert(fs.existsSync(path.join(web, 'out/index.html')), 'Static production build must exist before smoke');

const port = String(32000 + Math.floor(Math.random() * 8000));
const child = spawn('node', [path.join(root, 'scripts/serve-static.mjs'), port], {
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
    if (child.exitCode !== null) throw new Error('Static export server exited prematurely: ' + logs);
    try {
      const response = await fetch('http://127.0.0.1:' + port, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { html = await response.text(); break; }
    } catch { /* server not ready */ }
    await sleep(500);
  }
  assert(html, 'Static export server did not become ready: ' + logs);
  for (const required of ['lang="ar"', 'dir="rtl"', 'نور القرآن', 'صفحة تجريبية']) {
    assert(html.includes(required), 'Missing rendered value: ' + required);
  }
  // #302: default-off Admin routes are still exported, but must not render
  // administrative data or the authenticated sidebar in public static HTML.
  // Cheap HTTP smoke: no Chrome, auth fixture, remote service or secrets.
  for (const route of ['/admin/', '/admin/teachers/', '/admin/subscriptions/']) {
    const response = await fetch('http://127.0.0.1:' + port + route, {
      signal: AbortSignal.timeout(3000),
    });
    assert.equal(response.status, 200, 'Missing static Admin route: ' + route);
    const page = await response.text();
    assert(page.includes('لوحة الإدارة غير مفعّلة'), 'Admin gate not default-off: ' + route);
    for (const sensitive of ['نظرة عامة على الأكاديمية', 'ملفات الطلاب النشطة',
      'مؤشرات من السجل الفعلي', 'إحصاءات الأكاديمية الموثقة']) {
      assert(!page.includes(sensitive), 'Protected Admin section in public HTML: ' + route);
    }
    assert(page.includes('dir="rtl"'), 'Admin page is not Arabic RTL: ' + route);
  }
  console.log('Default-off Admin static exports: three routes gated, no aggregate metrics PASS');
  console.log('Production HTTP smoke OK (Arabic/RTL, static export server)');
} finally {
  child.kill('SIGTERM');
}
