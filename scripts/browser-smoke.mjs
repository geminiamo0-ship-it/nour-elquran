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
assert(fs.existsSync(path.join(web, 'out/index.html')), 'Static production build required before browser smoke');

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
  const server = launch('node', [path.join(root, 'scripts/serve-static.mjs'), String(port)], {
    cwd: web,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  });
  await waitFor(async () => {
    if (server.exitCode !== null) throw new Error('Static export server exited: ' + server.exitCode);
    return (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok;
  }, 'Static export production server');

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
    ['lessons', 'سجل الحصص'], ['training', 'كل تدريب له هدف واضح'],
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
      expression:"Boolean(document.querySelector('[aria-label^=\"تحديد الآية\"]'))",
      returnByValue:true,
    });
    return Boolean(read.result?.value);
  }, 'publisher ayah polygon click regions ready');
  const quranReadingScreen=await socket.send('Page.captureScreenshot', {format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(screenshots,'quran-mobile-reading-390.png'),Buffer.from(quranReadingScreen.data,'base64'));
  // Use a REAL pointer hit test, not Element.click(): the SVG may exist but be
  // visually covered, clipped, or have pointer-events disabled.
  const tapPoint = await socket.send('Runtime.evaluate', {
    expression: `(()=>{const paths=[...document.querySelectorAll('path[aria-label^="تحديد الآية"]')];for(const path of paths){const r=path.getBoundingClientRect();if(r.width<3||r.height<3)continue;for(let yi=1;yi<=9;yi++){for(let xi=1;xi<=9;xi++){const x=r.left+r.width*xi/10,y=r.top+r.height*yi/10;if(x<0||y<0||x>=innerWidth||y>=innerHeight)continue;if(document.elementFromPoint(x,y)===path)return {x,y,label:path.getAttribute('aria-label')};}}}return null;})()`,
    returnByValue:true,
  });
  const point=tapPoint.result?.value;
  assert(point && Number.isFinite(point.x) && Number.isFinite(point.y),
    'Quran polygon is rendered but cannot receive a physical tap in the viewport');
  await socket.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
  await socket.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
  const firstTapState=await socket.send('Runtime.evaluate',{
    expression:`(async()=>{await new Promise(r=>setTimeout(r,100));const highlighted=[...document.querySelectorAll('path[aria-label^="تحديد الآية"]')].some(x=>x.getAttribute('class')?.includes('selected'));return {highlighted,noEditor:!document.querySelector('#quran-note')};})()`,
    awaitPromise:true,returnByValue:true,
  });
  assert(firstTapState.result?.value?.highlighted&&firstTapState.result?.value?.noEditor,
    'First Quran tap must highlight only, without opening note: '+JSON.stringify(firstTapState.result?.value));
  await socket.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:2});
  await socket.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:2});
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
  // S06 regression: one finger must paint when marker is selected (previous code rejected touch).
  await socket.send('Runtime.evaluate',{expression:`document.querySelector('button[title="ماركر"]')?.click()`,returnByValue:true});
  const inkInfo=await socket.send('Runtime.evaluate',{
    expression:`(()=>{const svg=document.querySelector('svg[data-ink-mode="marker"]');const panel=document.querySelector('[aria-label="ألوان وأدوات الرسم"]');const r=svg?.getBoundingClientRect();const dots=panel?.querySelectorAll('[aria-label^="لون "]');const a=dots?.[0]?.getBoundingClientRect(),b=dots?.[1]?.getBoundingClientRect();return {x:r?.left+r.width*.5,y:r?.top+r.height*.5,active:!!svg,palette:!!panel,vertical:!!a&&!!b&&b.top>a.bottom-3};})()`,returnByValue:true,
  });
  const info=inkInfo.result?.value;
  assert(info&&info.active&&info.palette&&info.vertical&&Number.isFinite(info.x)&&Number.isFinite(info.y),
    'Ink mode must expose vertical palette and full-page pointer area: '+JSON.stringify(info));
  await socket.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  await socket.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:info.x,y:info.y}]});
  await socket.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:info.x+10,y:info.y+14}]});
  await socket.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:info.x+25,y:info.y+29}]});
  await socket.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await socket.send('Emulation.setTouchEmulationEnabled',{enabled:false});
  const inkDrawn=await socket.send('Runtime.evaluate',{
    expression:`(()=>{const paths=document.querySelectorAll('svg[data-ink-mode="marker"] path');const canvas=document.querySelector('[aria-label^="مصحف المدينة، الصفحة"]');return {strokes:paths.length,sheetHeight:canvas?.getBoundingClientRect().height,animation:getComputedStyle(document.querySelector('[data-rendered-quran-page]')).animationName};})()`,returnByValue:true,
  });
  assert(inkDrawn.result?.value?.strokes>0&&inkDrawn.result?.value?.sheetHeight>420,
    'Finger marker must draw on the Quran without resizing sheet: '+JSON.stringify(inkDrawn.result?.value));
  const quranInkScreen=await socket.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(screenshots,'quran-touch-marker-vertical-palette-390.png'),Buffer.from(quranInkScreen.data,'base64'));
  console.log('Quran S06 real finger touch drawing, vertical animated palette and unchanged Quran sheet passed');
  await socket.send('Emulation.setDeviceMetricsOverride', {
    width:1440,height:900,deviceScaleFactor:1,mobile:false,
  });


  // QuranFlash-inspired information architecture, but Noor's own visual system.
  // Desktop must display two fully interactive physical pages, not a tiny card.
  await socket.send('Emulation.setDeviceMetricsOverride', {width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await socket.send('Page.navigate',{url:url+'student/mushaf'});
  await waitFor(async()=>{
    const out=await socket.send('Runtime.evaluate',{
      expression:`(()=>{const b=document.querySelector('[aria-label="تقليب إلى الصفحة التالية"]');return !!b&&Object.keys(b).some(k=>k.includes('reactProps'));})()`,returnByValue:true,
    });return Boolean(out.result?.value);
  },'desktop Quran reader shell');
  const spread=await socket.send('Runtime.evaluate',{
    expression:`(async()=>{const pause=()=>new Promise(r=>setTimeout(r,210));const next=document.querySelector('[aria-label="تقليب إلى الصفحة التالية"]');next?.click();await pause();next?.click();await pause();const actual=document.querySelector('[data-spread-pages]')?.getAttribute('data-spread-pages');const pages=document.querySelectorAll('[aria-label^="مصحف المدينة، الصفحة"]').length;return {actual,pages};})()`,
    awaitPromise:true,returnByValue:true,
  });
  assert(spread.result?.value?.actual==='2,3'&&spread.result?.value?.pages===2,
    'Desktop Quran spread must have two physical interactive leaves: '+JSON.stringify(spread.result?.value));
  await socket.send('Runtime.evaluate',{
    expression:`document.querySelector('[aria-label="فتح فهرس المصحف"]')?.click()`,
    returnByValue:true,
  });
  const drawerVisible=await socket.send('Runtime.evaluate',{
    expression:`Boolean(document.querySelector('[aria-label="أقسام فهرس المصحف"]'))`,returnByValue:true,
  });
  assert(drawerVisible.result?.value===true,'Quran index should open in a separate responsive drawer');
  const desktopSpreadImage=await socket.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(screenshots,'quran-desktop-spread-index-1440.png'),Buffer.from(desktopSpreadImage.data,'base64'));
  console.log('Desktop Noor Quran 2-page spread and index drawer regression passed');

  // S08: reciter selector / current-page scope / speed / repeat, no audio fetch until playback.
  await socket.send('Runtime.evaluate',{
    expression:`document.querySelector('[aria-label="إغلاق لوحة الملاحظات"]')?.click();document.querySelector('[aria-label="فتح مشغل التلاوة"]')?.click();`,
    returnByValue:true,
  });
  await waitFor(async()=>{
    const r=await socket.send('Runtime.evaluate',{
      expression:`Boolean(document.querySelector('[aria-label="اختيار القارئ"]'))`,returnByValue:true,
    });return Boolean(r.result?.value);
  },'Quran reciters player mount');
  const quranReciterControls=await socket.send('Runtime.evaluate',{
    expression:`(async()=>{const sleep=t=>new Promise(r=>setTimeout(r,t));const reciter=document.querySelector('[aria-label="اختيار القارئ"]');const scope=document.querySelector('[aria-label="نطاق التلاوة"]');const repeat=document.querySelector('[aria-label="عدد مرات التكرار"]');const speed=document.querySelector('[aria-label="سرعة التلاوة"]'); const player=!!document.querySelector('[aria-label="مشغل التلاوة"]'); const hasSix=reciter?.options.length===6;let names=[...reciter.options].map(o=>o.textContent); const goodNames=names.includes('مشاري راشد العفاسي')&&names.includes('ماهر المعيقلي');const noAutoplay=!document.querySelector('[aria-label="مشغل التلاوة"] audio')?.currentSrc;const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;setter.call(reciter,'muaiqly');reciter.dispatchEvent(new Event('change',{bubbles:true}));setter.call(scope,'surah');scope.dispatchEvent(new Event('change',{bubbles:true}));setter.call(repeat,'3');repeat.dispatchEvent(new Event('change',{bubbles:true}));setter.call(speed,'1.25');speed.dispatchEvent(new Event('change',{bubbles:true}));await sleep();return {player,hasSix,goodNames,noAutoplay,changed:reciter.value==='muaiqly'&&scope.value==='surah'&&repeat.value==='3'&&speed.value==='1.25'};})()`,
    awaitPromise:true,returnByValue:true,
  });
  const reciterValues=quranReciterControls.result?.value;
  assert(reciterValues&&Object.values(reciterValues).every(Boolean),
    'Quran Hafs reciter player controls failed: '+JSON.stringify(reciterValues??quranReciterControls));
  console.log('Quran S08 six Hafs reciters, no autoplay, scope, 3x repeat and 1.25x speed smoke passed');
  const reciterImage=await socket.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(screenshots,'quran-reciter-player-1440.png'),Buffer.from(reciterImage.data,'base64'));


  // P1: short 375x667 phone; audio controls must NOT steal 100+px or shrink the Quran.
  await socket.send('Emulation.setDeviceMetricsOverride',{
    width:375,height:667,deviceScaleFactor:1,mobile:false,
  });
  await socket.send('Page.navigate',{url:url+'student/mushaf'});
  await waitFor(async()=>{
    const ready=await socket.send('Runtime.evaluate',{
      expression:"(()=>{const play=document.querySelector('[aria-label=\"فتح مشغل التلاوة\"]');return !!play&&Object.keys(play).some(k=>k.includes('reactProps'));})()",
      returnByValue:true,
    });
    return Boolean(ready.result?.value);
  },'mobile Quran toolbelt hydration');
  const compact=await socket.send('Runtime.evaluate',{
    expression:`(async()=>{const nap=t=>new Promise(r=>setTimeout(r,t));const next=document.querySelector('[aria-label="تقليب إلى الصفحة التالية"]');next?.click();next?.click();await nap(180);document.querySelector('[aria-label="فتح مشغل التلاوة"]')?.click();await nap(140);const sheet=document.querySelector('[aria-label^="مصحف المدينة، الصفحة"]');const dock=document.querySelector('[aria-label="مشغل التلاوة"]');const opts=document.querySelector('#quran-audio-advanced');const settings=document.querySelector('[aria-label="إعدادات التلاوة المتقدمة"]');const first=sheet?.getBoundingClientRect();const dockSize=dock?.getBoundingClientRect().height??999;const initiallyHidden=!!opts&&getComputedStyle(opts).display==='none'&&settings?.getAttribute('aria-expanded')==='false';settings?.click();await nap(130);const second=sheet?.getBoundingClientRect();const nowVisible=!!opts&&getComputedStyle(opts).display!=='none'&&settings?.getAttribute('aria-expanded')==='true';const popup=opts?.getBoundingClientRect();const popupOnScreen=!!popup&&popup.top>=0&&popup.bottom<667;const hasFeatures=!!opts?.querySelector('[aria-label="اختيار القارئ"]')&&!!opts?.querySelector('[aria-label="نطاق التلاوة"]')&&!!opts?.querySelector('[aria-label="عدد مرات التكرار"]')&&!!opts?.querySelector('[aria-label="سرعة التلاوة"]')&&!!opts?.querySelector('[aria-label="موضع التلاوة"]');return {pageHeight:Math.round(first?.height??0),dockHeight:Math.round(dockSize),initiallyHidden,nowVisible,hasFeatures,popupOnScreen,unchanged:!!first&&!!second&&Math.abs(first.height-second.height)<2};})()`,
    awaitPromise:true,returnByValue:true,
  });
  const c=compact.result?.value;
  assert(c&&c.pageHeight>430&&c.dockHeight<58&&c.initiallyHidden&&c.nowVisible&&c.hasFeatures&&c.popupOnScreen&&c.unchanged,
    'Compact Quran must keep sheet tall while all recitation options expand: '+JSON.stringify(c??compact));
  const audioCompactScreenshot=await socket.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(screenshots,'quran-compact-player-375.png'),Buffer.from(audioCompactScreenshot.data,'base64'));
  console.log('Quran P1 page-first 375x667: dock <58px, full controls accessible, no page shift passed');
  await socket.send('Emulation.setDeviceMetricsOverride',{
    width:1440,height:900,deviceScaleFactor:1,mobile:false,
  });


  // S09 Training IA — homework, independent self-study and next lesson readiness.
  await socket.send('Emulation.setDeviceMetricsOverride',{
    width:390,height:844,deviceScaleFactor:1,mobile:false,
  });
  await socket.send('Page.navigate',{url:url+'student/training'});
  await waitFor(async()=>{
    const q=await socket.send('Runtime.evaluate',{
      expression:`(()=>{const sw=document.querySelector('#learner-switch');return !!sw&&Object.keys(sw).some(k=>k.includes('reactProps'));})()`,
      returnByValue:true,
    });return Boolean(q.result?.value);
  },'hydrated student training workspace');
  const trainingCase=await socket.send('Runtime.evaluate',{
    expression:`(async()=>{const wait=()=>new Promise(r=>setTimeout(r,180));const sw=document.querySelector('#learner-switch');const tabs=[...document.querySelectorAll('[role="tab"]')];const three=tabs.length===3;const blank=document.body.textContent.includes('لا توجد تكليفات معتمدة من شيخ');sw.value='demo-active';sw.dispatchEvent(new Event('change',{bubbles:true}));await wait();const cards=[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('ابدأ الواجب في المصحف'));const two=cards.length===2;cards[0]?.click();await wait();const viewer=!!document.querySelector('[aria-label^="عارض تدريب القرآن"]');const sameQuran=!!document.querySelector('[aria-label^="مصحف المدينة، الصفحة"]');const practice=document.getElementById('training-tab-practice');practice?.click();await wait();const threeSamples=document.querySelectorAll('[aria-pressed][class*="sample"]').length===3;const preparation=document.getElementById('training-tab-prepare');preparation?.click();await wait();const next=document.body.textContent.includes('الاستعداد للحصة')&&document.body.textContent.includes('مراجعة سورة الإخلاص');return {three,blank,two,viewer,sameQuran,threeSamples,next};})()`,
    awaitPromise:true,returnByValue:true,
  });
  const training=trainingCase.result?.value;
  assert(training&&Object.values(training).every(Boolean),
    'Student Training 3 tabs, learner isolation, shared Quran viewer or next lesson failed: '+JSON.stringify(training??trainingCase));
  const trainingShot=await socket.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(screenshots,'student-training-390.png'),Buffer.from(trainingShot.data,'base64'));
  console.log('Student Training 3 tabs, two approved demo homework ranges, same Quran renderer and upcoming lesson smoke passed');
  await socket.send('Emulation.setDeviceMetricsOverride',{
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


  // TEACHER #45: real production-exported React routes, mobile RTL and states.
  for (const teacherSection of ['', 'schedule', 'students', 'preparation', 'assignments',
    'reports', 'notifications', 'cases']) {
    const pageUrl = url + 'teacher' + (teacherSection ? '/' + teacherSection : '');
    const response = await fetch(pageUrl);
    assert.equal(response.status, 200, 'Missing teacher preview route: ' + pageUrl);
    const body = await response.text();
    assert(body.includes('معاينة واجهة الشيخ'), 'Teacher route must explicitly disclose mock data');
  }
  for (const width of [360,390,1440]) {
    await socket.send('Emulation.setDeviceMetricsOverride', {
      width, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    await socket.send('Page.navigate', {url:url+'teacher'});
    const teacherReady = await waitFor(async () => {
      const result=await socket.send('Runtime.evaluate', {
        expression: "(() => ({ready:document.readyState,heading:document.querySelector('#teacher-content h1')?.textContent,viewport:innerWidth,scroll:document.documentElement.scrollWidth,rtl:document.documentElement.dir,preview:document.body.textContent.includes('معاينة واجهة الشيخ')}))()",
        returnByValue:true,
      });
      const value=result.result?.value;
      return value?.ready==='complete'&&value?.heading?.includes('أهلًا بك')?value:null;
    }, 'teacher preview '+width);
    assert.equal(teacherReady.rtl,'rtl');
    assert.equal(teacherReady.viewport,width);
    assert(teacherReady.scroll<=width,'Teacher horizontal overflow at '+width+': '+teacherReady.scroll);
    assert(teacherReady.preview,'Teacher mock disclosure absent');
    const screenshot=await socket.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    const png=Buffer.from(screenshot.data,'base64');
    assert.equal(png.readUInt32BE(16),width);
    fs.writeFileSync(path.join(screenshots,'teacher-home-'+width+'.png'),png);
  }
  await socket.send('Emulation.setDeviceMetricsOverride', {
    width:1440,height:900,deviceScaleFactor:1,mobile:false,
  });
  await socket.send('Page.navigate',{url:url+'teacher'});
  await waitFor(async()=>{
    const res=await socket.send('Runtime.evaluate',{
      expression:"(() => { const el=document.querySelector('#teacher-scenario'); return !!el && el.options.length>=7 && Object.keys(el).some(key=>key.startsWith('__reactProps')); })()",
      returnByValue:true,
    });
    return res.result?.value===true;
  }, 'teacher scenario select');
  const scenarioCheck=await socket.send('Runtime.evaluate',{
    expression:"(async()=>{ const sel=document.querySelector('#teacher-scenario'); sel.value='empty'; sel.dispatchEvent(new Event('change',{bubbles:true})); await new Promise(r=>setTimeout(r,220)); return {blank:document.querySelector('#teacher-content')?.textContent.includes('جدولك خالٍ'),mock:document.body.textContent.includes('لا يوجد نشر تقارير')}; })()",
    returnByValue:true,awaitPromise:true,
  });
  assert(scenarioCheck.result?.value?.blank===true &&
    scenarioCheck.result?.value?.mock===true,
    'Teacher empty roster scenario did not re-render: '+JSON.stringify(scenarioCheck.result?.value));
  console.log('Teacher A-Z routes, mobile 360/390/1440 RTL, screenshot and empty state passed');


  // CLASSROOM #50: actual Quran reader route, preview permissions and responsive RTL.
  const classroomResponse=await fetch(url+'classroom');
  assert.equal(classroomResponse.status,200,'Classroom static preview route missing');
  assert((await classroomResponse.text()).includes('معاينة الفصل التفاعلي فقط'),
    'Classroom must clearly disclose nonproduction room state');
  for(const width of [360,390,1440]){
    await socket.send('Emulation.setDeviceMetricsOverride',{
      width,height:900,deviceScaleFactor:1,mobile:false,
    });
    await socket.send('Page.navigate',{url:url+'classroom'});
    const cls=await waitFor(async()=>{
      const result=await socket.send('Runtime.evaluate',{
        expression:"(()=>({heading:document.querySelector('h1')?.textContent,rtl:document.documentElement.dir,viewport:innerWidth,scroll:document.documentElement.scrollWidth,quran:!!document.querySelector('[aria-label=\\\"مصحف المدينة، الصفحة 604\\\"]')}))()",
        returnByValue:true,
      });
      const value=result.result?.value;
      return value?.heading?.includes('الفصل التفاعلي')?value:null;
    },'classroom preview '+width);
    assert.equal(cls.rtl,'rtl');
    assert.equal(cls.viewport,width);
    assert(cls.scroll<=width,'Classroom overflow at '+width+': '+cls.scroll);
    assert(cls.quran,'Classroom does not reuse canonical Madinah reader');
    const snap=await socket.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    const image=Buffer.from(snap.data,'base64');
    assert.equal(image.readUInt32BE(16),width);
    fs.writeFileSync(path.join(screenshots,'classroom-'+width+'.png'),image);
  }
  await socket.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await socket.send('Page.navigate',{url:url+'classroom'});
  await waitFor(async()=>{
    const response=await socket.send('Runtime.evaluate',{
      expression:"(()=>{const el=document.querySelector('select[aria-label=\\\"تبديل منظور المعاينة\\\"]');return !!el&&Object.keys(el).some(k=>k.startsWith('__reactProps'));})()",
      returnByValue:true,
    });
    return response.result?.value===true;
  },'hydrated classroom roles');
  const classroomInteraction=await socket.send('Runtime.evaluate',{
    expression:`(async()=>{const pause=()=>new Promise(r=>setTimeout(r,190));
      const buttons=()=>[...document.querySelectorAll('button')];
      const start=buttons().find(b=>b.textContent.includes('محاكاة «بدء الحصة»'));
      const before=start?.disabled===true;
      const people=[...document.querySelectorAll('input[type=checkbox]')];
      people[1]?.click();await pause();
      const both=start?.disabled===false;
      start?.click();await pause();
      const live=document.body.textContent.includes('حصة تجريبية جارية');
      const hasQuran=!!document.querySelector('[aria-label^="مصحف المدينة، الصفحة"]');
      const studentRole=document.querySelector('select[aria-label="تبديل منظور المعاينة"]');
      studentRole.value='student';studentRole.dispatchEvent(new Event('change',{bubbles:true}));await pause();
      const endBtn=buttons().find(b=>b.textContent.includes('إنهاء الفصل بيد الشيخ'));
      const noStudentEnd=endBtn?.disabled===true;
      const nav=buttons().find(b=>b.textContent.includes('صفحة تالية'));
      const noStudentNavigation=nav?.disabled===true;
      const clock=document.querySelector('input[type=range]');
      clock.value='42';clock.dispatchEvent(new Event('input',{bubbles:true}));clock.dispatchEvent(new Event('change',{bubbles:true}));await pause();
      const notAutoEnded=document.body.textContent.includes('حصة تجريبية جارية');
      return {before,both,live,hasQuran,noStudentEnd,noStudentNavigation,notAutoEnded};
    })()`,
    awaitPromise:true,returnByValue:true,
  });
  const classroomChecks=classroomInteraction.result?.value;
  assert(classroomChecks&&Object.values(classroomChecks).every(Boolean),
    'Classroom React safety preview smoke failed: '+JSON.stringify(classroomChecks??classroomInteraction));

  // Immersive focus layout #50: no document scrollbar; the Quran sheet must
  // fit inside its stage. Mobile learner view shows Sheikh video ABOVE Quran.
  for(const width of [360,390,768,1440]){
    await socket.send('Emulation.setDeviceMetricsOverride',{
      width,height:900,deviceScaleFactor:1,mobile:false,
    });
    await socket.send('Page.navigate',{url:url+'classroom'});
    await waitFor(async()=>{
      const x=await socket.send('Runtime.evaluate',{
        expression:"(()=>{const el=document.querySelector('select[aria-label=\\\"تبديل منظور المعاينة\\\"]');return !!el&&Object.keys(el).some(k=>k.startsWith('__reactProps'));})()",
        returnByValue:true,
      });
      return x.result?.value===true;
    },'immersive viewport hydration '+width);
    await socket.send('Runtime.evaluate',{
      expression:"(()=>{const sel=document.querySelector('select[aria-label=\\\"تبديل منظور المعاينة\\\"]'); sel.value='student';sel.dispatchEvent(new Event('change',{bubbles:true}));return true;})()",
      returnByValue:true,
    });
    await sleep(300);
    const geometry=await socket.send('Runtime.evaluate',{
      expression:`(()=>{
        const quran=document.querySelector('[aria-label="المصحف المشترك داخل الفصل"]');
        const video=document.querySelector('[aria-label="لوحة فيديو المشاركين"]');
        const sheet=document.querySelector('[aria-label^="مصحف المدينة، الصفحة"]');
        const qr=quran?.getBoundingClientRect(),vr=video?.getBoundingClientRect(),
              sr=sheet?.getBoundingClientRect();
        return {
          noPageScroll:document.documentElement.scrollHeight<=innerHeight+2,
          videoFirst:innerWidth>760 || (!!vr&&!!qr&&vr.top<qr.top&&vr.bottom<=qr.top+3),
          sheetFits:!!sr&&!!qr&&sr.top>=qr.top-3&&sr.bottom<=qr.bottom+3,
          windowHeight:innerHeight,documentHeight:document.documentElement.scrollHeight,
          quranTop:qr?.top,videoTop:vr?.top,sheetBottom:sr?.bottom,quranBottom:qr?.bottom,
          role:document.querySelector('[data-view-role]')?.getAttribute('data-view-role')
        };
      })()`,
      returnByValue:true,
    });
    await socket.send('Runtime.evaluate',{
      expression:"(()=>{[...document.querySelectorAll('button')].find(b=>b.textContent.includes('وضع الحصة'))?.click();return true;})()",
      returnByValue:true,
    });
    await sleep(160);
    const focusCheck=await socket.send('Runtime.evaluate',{
      expression:"document.querySelector('[data-focus]')?.getAttribute('data-focus')==='on'",
      returnByValue:true,
    });
    const actual={...(geometry.result?.value||{}),focusOn:focusCheck.result?.value===true};
    for(const field of ['noPageScroll','videoFirst','sheetFits','focusOn']){
      assert(actual?.[field]===true,'Immersive '+width+'px '+field+' failed: '+JSON.stringify(actual));
    }
  }
  console.log('Immersive no-scroll classroom and student-first Sheikh video Chrome checks passed');


  // Regression: previously all tests passed while the page was visibly tiny,
  // because they only checked that the Quran FIT, not how much room it USED.
  // Check real SHORT mobile viewport and normal desktop, with width + height.
  for(const viewport of [
    {width:360,height:667,role:'student',minimumWidth:205,minimumVideoHeight:75},
    {width:390,height:844,role:'student',minimumWidth:245,minimumVideoHeight:80},
    {width:1280,height:900,role:'teacher',minimumWidth:395,minimumVideoHeight:180},
    {width:1440,height:900,role:'teacher',minimumWidth:395,minimumVideoHeight:180},
  ]){
    await socket.send('Emulation.setDeviceMetricsOverride',{
      width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:false,
    });
    await socket.send('Page.navigate',{url:url+'classroom'});
    await waitFor(async()=>{
      const r=await socket.send('Runtime.evaluate',{
        expression:"(()=>{const el=document.querySelector('select[aria-label=\\\"تبديل منظور المعاينة\\\"]');return !!el&&Object.keys(el).some(k=>k.startsWith('__reactProps'));})()",
        returnByValue:true,
      });
      return r.result?.value===true;
    },'Quran physical-size readiness '+viewport.width+'x'+viewport.height);
    if(viewport.role==='student'){
      await socket.send('Runtime.evaluate',{
        expression:"(()=>{const e=document.querySelector('select[aria-label=\\\"تبديل منظور المعاينة\\\"]');e.value='student';e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()",
        returnByValue:true,
      });
      await sleep(220);
    }
    const r=await socket.send('Runtime.evaluate',{
      expression:`(()=>{
        const stage=document.querySelector('[aria-label="المصحف المشترك داخل الفصل"]');
        const viewport=stage?.querySelector('[class*="quranViewport"]');
        const page=document.querySelector('[aria-label^="مصحف المدينة، الصفحة"]');
        const video=document.querySelector('[aria-label="لوحة فيديو المشاركين"]');
        const p=page?.getBoundingClientRect();
        const v=video?.getBoundingClientRect();
        const q=stage?.getBoundingClientRect();
        const vp=viewport?.getBoundingClientRect();
        return {pageWidth:p?.width,pageHeight:p?.height,stageHeight:q?.height,
          viewportHeight:vp?.height,videoHeight:v?.height,
          videoFirst:!v||!q||v.top<q.top,
          documentHeight:document.documentElement.scrollHeight,
          innerHeight:innerHeight,documentWidth:document.documentElement.scrollWidth,
          innerWidth:innerWidth,ratio:p?Number((p.width/p.height).toFixed(3)):null};
      })()`,
      returnByValue:true,
    });
    const values=r.result?.value;
    assert(values?.pageWidth>=viewport.minimumWidth,
      'Quran still TINY '+viewport.width+'x'+viewport.height+': '+JSON.stringify(values));
    assert(values?.videoHeight>=viewport.minimumVideoHeight,
      'Remote video under-allocated at '+viewport.width+'x'+viewport.height+': '+JSON.stringify(values));
    assert(Math.abs(values.ratio-(345/550))<0.012,
      'Canonical page aspect distorted: '+JSON.stringify(values));
    assert(values.documentHeight<=viewport.height+2 && values.documentWidth<=viewport.width+2,
      'Classroom outer document overflow: '+JSON.stringify(values));
    if(viewport.role==='student')assert(values.videoFirst,
      'Sheikh camera must be BEFORE Quran on student phone: '+JSON.stringify(values));
    const shot=await socket.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    const png=Buffer.from(shot.data,'base64');
    fs.writeFileSync(path.join(screenshots,'classroom-size-'+viewport.role+'-'+viewport.width+'x'+viewport.height+'.png'),png);
    console.log('Physical Quran/video bounds '+viewport.width+'x'+viewport.height+': '+JSON.stringify(values));
  }

  console.log('Classroom reader, waiting room, teacher-only controls and 360/390/1440 Chrome smoke passed');

} finally {
  socket?.close();
  for (const child of children.reverse()) child.kill('SIGTERM');
  await sleep(500);
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
