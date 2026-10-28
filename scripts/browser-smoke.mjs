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
    ['mushaf', 'مصحف نور القرآن'],
  ]) {
    const response = await fetch(url + 'student/' + section, { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200, 'Student route did not render: ' + section);
    const markup = await response.text();
    assert(markup.includes(expected), 'Student section missing: ' + section);
  }
  console.log('Student portal subroute HTTP smoke passed: 7 feature pages');

  // S04: real 604-page Quran reader controls and sibling-local route state.
  await socket.send('Page.navigate', { url: url + 'student/mushaf' });
  await waitFor(async () => {
    const result = await socket.send('Runtime.evaluate', {
      expression: "document.querySelector('#quran-page-input') && Object.keys(document.querySelector('#quran-page-input')).some(k => k.includes('reactProps'))",
      returnByValue: true,
    });
    return Boolean(result.result?.value);
  }, 'hydrated real Madinah Mushaf reader');
  const mushafResult = await socket.send('Runtime.evaluate', {
    expression: "(async () => { const sleep=t=>new Promise(r=>setTimeout(r,t)); const input=document.querySelector('#quran-page-input');const initiallyFirst=input?.value==='1';const next=document.querySelector('button[aria-label=\"الصفحة التالية\"]');next?.click();await sleep(180);const second=document.querySelector('#quran-page-input')?.value==='2'; const ayah=document.querySelector('button[title=\"آية بآية\"]'); ayah?.click();await sleep(100);const toggled=ayah?.getAttribute('aria-pressed')==='true';const switcher=document.querySelector('#learner-switch');switcher.value='demo-active';switcher.dispatchEvent(new Event('change',{bubbles:true}));await sleep(180);const isolated=document.querySelector('#quran-page-input')?.value==='1';return {initiallyFirst,second,toggled,isolated};})()",
    awaitPromise: true, returnByValue: true,
  });
  const mushafValues = mushafResult.result?.value;
  assert(mushafValues && Object.values(mushafValues).every(Boolean),
    'S04 real Quran reader controls failed: ' + JSON.stringify(mushafValues ?? mushafResult));
  const surahNavigation = await socket.send('Runtime.evaluate', {
    expression: "Boolean(document.querySelector('#quran-surah-select'))",
    returnByValue: true,
  });
  assert(surahNavigation.result?.value === true, 'Surah navigation selector is absent');
  console.log('S04 Quran 604-page reader controls, alternate ayah mode and sibling reset smoke passed');

  // S05/S06: mobile reader acts like an in-app Quran app; image sheet must never collapse.
  await socket.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 840, deviceScaleFactor: 1, mobile: false,
  });
  await socket.send('Page.navigate', { url: url + 'student/mushaf' });
  await waitFor(async () => {
    const check = await socket.send('Runtime.evaluate', {
      expression: "document.querySelector('#quran-page-input') && [...document.querySelectorAll('button')].some(x=>x.textContent.includes('الخروج من وضع القراءة'))",
      returnByValue:true,
    });
    return Boolean(check.result?.value);
  }, 'immersive Quran mobile layout');
  const readingResult = await socket.send('Runtime.evaluate', {
    expression: "(async()=>{const sleep=t=>new Promise(r=>setTimeout(r,t)); const img=document.querySelector('[aria-label^=\"مصحف المدينة، الصفحة\"]'); const initial=img?.getBoundingClientRect(); const next=document.querySelector('button[aria-label=\"تقليب إلى الصفحة التالية\"]'); next?.click(); await sleep(120);const after=document.querySelector('[aria-label^=\"مصحف المدينة، الصفحة\"]')?.getBoundingClientRect(); const fixed=!!initial&&!!after&&initial.height>100&&Math.abs(initial.height-after.height)<2; const immersive=[...document.querySelectorAll('button')].some(x=>x.textContent.includes('الخروج من وضع القراءة')); const show=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='إظهار الأدوات');show?.click();await sleep(100);const search=document.querySelector('button[aria-label=\"بحث شامل في المصحف\"]');search?.click();await sleep(100);const query=!!document.querySelector('#whole-quran-query');const tools=!!document.querySelector('button[title=\"ماركر\"]');const notes=[...document.querySelectorAll('button')].some(x=>x.textContent.includes('جميع ملاحظاتي'));return {fixed,immersive,query,tools,notes};})()",
    awaitPromise:true, returnByValue:true,
  });
  const readingChecks=readingResult.result?.value;
  assert(readingChecks && Object.values(readingChecks).every(Boolean),
    'Immersive Quran, stable image frame and tools failed: '+JSON.stringify(readingChecks??readingResult));
  console.log('Quran immersive mobile, fixed image geometry, fulltext search and ink controls passed');
  await socket.send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
  });




  // P0: on printed page the exact ayah SVG polygon itself must open the editor.
  await socket.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: false,
  });
  await socket.send('Page.navigate', { url: url + 'student/mushaf' });
  await waitFor(async () => {
    const read=await socket.send('Runtime.evaluate', {
      expression:"Boolean(document.querySelector('[aria-label^=\"افتح ملاحظة الآية\"]'))",
      returnByValue:true,
    });
    return Boolean(read.result?.value);
  }, 'publisher ayah polygon click regions ready');
  const quranReadingScreen=await socket.send('Page.captureScreenshot', {format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(screenshots,'quran-mobile-reading-390.png'),Buffer.from(quranReadingScreen.data,'base64'));
  // Use a REAL pointer hit test, not Element.click(): the SVG may exist but be
  // visually covered, clipped, or have pointer-events disabled.
  const tapPoint = await socket.send('Runtime.evaluate', {
    expression: `(()=>{const paths=[...document.querySelectorAll('path[aria-label^="افتح ملاحظة الآية"]')];for(const path of paths){const r=path.getBoundingClientRect();if(r.width<3||r.height<3)continue;for(let yi=1;yi<=9;yi++){for(let xi=1;xi<=9;xi++){const x=r.left+r.width*xi/10,y=r.top+r.height*yi/10;if(x<0||y<0||x>=innerWidth||y>=innerHeight)continue;if(document.elementFromPoint(x,y)===path)return {x,y,label:path.getAttribute('aria-label')};}}}return null;})()`,
    returnByValue:true,
  });
  const point=tapPoint.result?.value;
  assert(point && Number.isFinite(point.x) && Number.isFinite(point.y),
    'Quran polygon is rendered but cannot receive a physical tap in the viewport');
  await socket.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
  await socket.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
  await waitFor(async()=>{
    const result=await socket.send('Runtime.evaluate',{
      expression:"Boolean(document.querySelector('#quran-note'))",returnByValue:true,
    });return Boolean(result.result?.value);
  },'actual pointer tap opens Quran note editor');
  const quranNoteScreen=await socket.send('Page.captureScreenshot', {format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(screenshots,'quran-mobile-note-390.png'),Buffer.from(quranNoteScreen.data,'base64'));
  const quranClickInteraction=await socket.send('Runtime.evaluate', {
    expression:"(async()=>{const pause=()=>new Promise(r=>setTimeout(r,200)); const sheet=document.querySelector('[aria-label^=\"مصحف المدينة، الصفحة\"]'); const before=sheet?.getBoundingClientRect(); await pause(); const editor=!!document.querySelector('#quran-note'); const close=!!document.querySelector('[aria-label=\"إغلاق لوحة الملاحظات\"]'); const note=document.querySelector('#quran-note');if(note){const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;setter.call(note,'مراجعة تطبيقية');note.dispatchEvent(new Event('input',{bubbles:true}));}await pause();[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='حفظ الملاحظة')?.click();await pause();const saved=document.body.textContent.includes('اتحفظت الملاحظة مؤقتًا')||document.body.textContent.includes('ملاحظات الصفحة');document.querySelector('[aria-label=\"إغلاق لوحة الملاحظات\"]')?.click();await pause();const dismissed=!document.querySelector('#quran-note');const after=sheet?.getBoundingClientRect();return {editor,close,saved,dismissed,stable:!!before&&!!after&&Math.abs(before.height-after.height)<3,large:!!before&&before.height>420};})()",
    awaitPromise:true,returnByValue:true,
  });
  const interactionValues=quranClickInteraction.result?.value;
  assert(interactionValues && Object.values(interactionValues).every(Boolean),
    'Quran printed verse click, note save and compact mobile sheet failed: '+JSON.stringify(interactionValues??quranClickInteraction));
  console.log('Quran P0 printed-page polygon tap, note editor, save, dismissal and viewport geometry passed');
  await socket.send('Emulation.setDeviceMetricsOverride', {
    width:1440,height:900,deviceScaleFactor:1,mobile:false,
  });

  // S01: semantic progress table, in-row report details, no approved report filters.
  await socket.send('Page.navigate', { url: url + 'student/progress' });
  await waitFor(async () => {
    const result = await socket.send('Runtime.evaluate', {
      expression: "document.querySelector('#learner-switch')?.options.length >= 5",
      returnByValue: true,
    });
    return Boolean(result.result?.value);
  }, 'hydrated progress route');
  const progressResult = await socket.send('Runtime.evaluate', {
    expression: "(async()=>{ const pause=()=>new Promise(r=>setTimeout(r,150)); const switcher=document.querySelector('#learner-switch'); switcher.value='demo-active'; switcher.dispatchEvent(new Event('change',{bubbles:true})); await pause(); const table=document.querySelector('table'); const headers=[...table.querySelectorAll('thead th')].map(x=>x.textContent); const noFilters=!document.querySelector('[aria-label=\"تصفية التقارير بحسب التقييم\"]'); const button=document.querySelector('table tbody button[aria-expanded]'); const before=button?.getAttribute('aria-expanded')==='false'; button?.click(); await pause(); const expanded=button?.getAttribute('aria-expanded')==='true'; const details=document.querySelector('table tbody tr td[colspan]')?.textContent.includes('المصحف المشروح'); switcher.value='demo-new'; switcher.dispatchEvent(new Event('change',{bubbles:true})); await pause(); const isolated=!document.querySelector('table')&&document.querySelector('#student-main')?.textContent.includes('لا توجد تقارير منشورة'); return {table:!!table,headers:headers.length===5,noFilters,before,expanded,details,isolated}; })()",
    awaitPromise: true, returnByValue: true,
  });
  const prog = progressResult.result?.value;
  assert(prog && Object.values(prog).every(Boolean),
    'S01 progress table Chrome smoke: ' + JSON.stringify(prog ?? progressResult));
  console.log('S01 progress RTL table, inline expansion, no filters and sibling isolation passed');


  // S02: approved attendance categories and local appeal preview only; sibling switch clears it.
  await socket.send('Page.navigate', { url: url + 'student/progress' });
  await waitFor(async () => {
    const result = await socket.send('Runtime.evaluate', {
      expression: "document.querySelector('#learner-switch')?.options.length >= 5",
      returnByValue: true,
    });
    return Boolean(result.result?.value);
  }, 'hydrated attendance route');
  const attendanceResult = await socket.send('Runtime.evaluate', {
    expression: "(async()=>{ const pause=()=>new Promise(r=>setTimeout(r,180)); const switcher=document.querySelector('#learner-switch'); switcher.value='demo-active'; switcher.dispatchEvent(new Event('change',{bubbles:true})); await pause(); const ledger=!!document.querySelector('[aria-label=\"جدول سجل الحضور والغياب\"] table'); const counts=document.querySelector('[aria-label=\"ملخص الحضور\"]')?.textContent.includes('أُعيدت جدولتها'); const button=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('طلب مراجعة الغياب')); const canAppeal=!!button; button?.click(); await pause(); const reason=!!document.querySelector('#attendance-appeal-reason'); const noSend=document.querySelector('#student-main')?.textContent.includes('لن يُرفع الملف أو يُرسل الطلب'); switcher.value='demo-new'; switcher.dispatchEvent(new Event('change',{bubbles:true})); await pause(); const isolated=!document.querySelector('[aria-label=\"جدول سجل الحضور والغياب\"] table')&&document.querySelector('#student-main')?.textContent.includes('لا توجد سجلات حضور'); return {ledger,counts,canAppeal,reason,noSend,isolated}; })()",
    awaitPromise: true, returnByValue: true,
  });
  const attendanceChecks = attendanceResult.result?.value;
  assert(attendanceChecks && Object.values(attendanceChecks).every(Boolean),
    'S02 attendance appeal Chrome smoke failed: ' + JSON.stringify(attendanceChecks ?? attendanceResult));
  console.log('S02 attendance ledger, appeal preview and learner isolation Chrome smoke passed');


  // S03: trial booking preference is only a preview, not a confirmed server reservation.
  await socket.send('Page.navigate', { url: url + 'student/lessons' });
  await waitFor(async () => {
    const result = await socket.send('Runtime.evaluate', {
      expression: "document.querySelector('#learner-switch')?.options.length >= 5",
      returnByValue: true,
    });
    return Boolean(result.result?.value);
  }, 'hydrated learner lesson booking screen');
  const bookingResult = await socket.send('Runtime.evaluate', {
    expression: "(async()=>{ const pause=()=>new Promise(r=>setTimeout(r,180)); const switcher=document.querySelector('#learner-switch'); switcher.value='demo-new'; switcher.dispatchEvent(new Event('change',{bubbles:true})); await pause(); const form=!!document.querySelector('#trial-weekday')&&!!document.querySelector('#trial-window'); const btn=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('راجع طلب التجربة')); btn?.click(); await pause(); const preview=document.querySelector('#student-main')?.textContent.includes('معاينة طلب حصة تجريبية'); const unsent=document.querySelector('#student-main')?.textContent.includes('تأكيد الحجز غير متاح'); const free=document.querySelector('#student-main')?.textContent.includes('0 جنيه'); switcher.value='demo-active'; switcher.dispatchEvent(new Event('change',{bubbles:true})); await pause(); const isolated=!document.querySelector('#trial-weekday')&&!document.querySelector('#student-main')?.textContent.includes('معاينة طلب حصة تجريبية'); return {form,preview,unsent,free,isolated}; })()",
    awaitPromise:true, returnByValue:true,
  });
  const bookingChecks=bookingResult.result?.value;
  assert(bookingChecks && Object.values(bookingChecks).every(Boolean),
    'S03 trial booking preview smoke failed: '+JSON.stringify(bookingChecks??bookingResult));
  console.log('S03 trial booking preview (free, no-send), weekly section and sibling isolation passed');

} finally {
  socket?.close();
  for (const child of children.reverse()) child.kill('SIGTERM');
  await sleep(500);
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
