import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { openLocalChrome, waitFor } from './chrome-local.mjs';
const base='http://127.0.0.1:8797/';
const browser=await openLocalChrome(base);
const password='Synthetic-Password-2026!';
async function present(selector) {
  return waitFor(()=>browser.evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`),selector);
}
async function hydrated() {
  await waitFor(()=>browser.evaluate("Object.keys(document.querySelector('#account-form') || {}).some(k=>k.includes('reactProps'))"),'hydrated account form');
}
async function fill(values,form='#account-form') {
  await browser.evaluate(`(()=>{const f=document.querySelector(${JSON.stringify(form)});for(const [name,value]of Object.entries(${JSON.stringify(values)})){const input=f.elements.namedItem(name);input.value=value;}f.requestSubmit();})()`);
}
async function profileNames() {
  return browser.evaluate("[...document.querySelectorAll('#learner-switch option')].map(x=>x.textContent)");
}
async function dashboard() { await present('#learner-switch'); }
try {
  await hydrated();
  // Old landing demo storage must never seed a connected account.
  await browser.evaluate("sessionStorage.setItem('noor:demo-profiles:v1',JSON.stringify(['DO NOT LOAD DEMO']))");
  for(const width of [360,390,1440]) {
    await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    const state=await browser.evaluate('({lang:document.documentElement.lang,dir:document.documentElement.dir,overflow:document.documentElement.scrollWidth>innerWidth})');
    assert.equal(state.lang,'ar');assert.equal(state.dir,'rtl');assert.equal(state.overflow,false,'Registration overflow at '+width);
    await browser.screenshot('artifacts/auth-browser/signup-'+width+'.png');
  }
  let lostProfileResponse=false, injectionError;
  browser.on('Fetch.requestPaused',async event=>{
    try {
      if(event.request.method==='POST'&&!lostProfileResponse) {
        lostProfileResponse=true;
        await browser.send('Fetch.failRequest',{requestId:event.requestId,errorReason:'Failed'});
      } else { await browser.send('Fetch.continueRequest',{requestId:event.requestId}); }
    }catch(error){injectionError=error;}
  });
  await browser.send('Fetch.enable',{patterns:[{urlPattern:'*/v1/me/learners',requestStage:'Response'}]});
  await fill({name:'Fixture Owner A',phoneNumber:'+12025550121',password,learnerName:'Fixture Learner A',learnerType:'child'});
  await waitFor(()=>browser.evaluate("document.body.textContent.includes('تم إنشاء الحساب. تعذّر إضافة الطالب')"),'partial registration recovery');
  assert(lostProfileResponse,'The successful profile response must actually be dropped');
  assert.equal(injectionError,undefined);
  await browser.send('Fetch.disable');
  await browser.go('/student/');await dashboard();
  assert.deepEqual(await profileNames(),['Fixture Learner A'],'Reload recovers the saved profile without duplicate signup/insert');
  const cookies=(await browser.send('Network.getCookies',{urls:[base]})).cookies;
  const sessionCookie=cookies.find(cookie=>cookie.name.includes('session_token'));
  assert(sessionCookie?.httpOnly,'Session cookie must be HttpOnly in the real browser');
  assert.equal(sessionCookie.sameSite,'Lax');
  assert.equal(await browser.evaluate("document.cookie.includes('session_token')"),false);
  for(const width of [360,390,1440]) {
    await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    const dashboardLayout=await browser.evaluate(`(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName,id:el.id,cls:typeof el.className==='string'?el.className.slice(0,100):'',left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width)};}).filter(x=>x.width>0&&(x.right>innerWidth+1||x.left < -1)).slice(0,20)}))()`);
    assert.equal(dashboardLayout.scroll>dashboardLayout.viewport,false,'Dashboard overflow at '+width+': '+JSON.stringify(dashboardLayout));
    await browser.screenshot('artifacts/auth-browser/dashboard-'+width+'.png');
  }
  await browser.go('/student/account/');await present('#create-learner-form');
  // #160: mobile selector must remain legible and open menu below the dynamic header.
  for(const [width,height] of [[360,667],[390,844],[768,1024],[1280,900],[1440,900]]){
    await browser.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768});
    const layout=await browser.evaluate(`(()=>{
      const select=document.querySelector('#learner-switch');
      const header=document.querySelector('header');
      const name=header?.querySelector('[title="Fixture Learner A"]');
      return {scroll:document.documentElement.scrollWidth,viewport:innerWidth,
        selectWidth:Math.round(select.getBoundingClientRect().width),
        visibleName:Boolean(name && getComputedStyle(name).display!=='none')};
    })()`);
    assert(layout.scroll<=layout.viewport,'Account header overflow at '+width);
    if(width<=390){assert(layout.selectWidth>=200,'Selected learner too narrow at '+width);}
    await browser.screenshot('artifacts/auth-browser/account-header-'+width+'.png');
  }
  await browser.send('Emulation.setDeviceMetricsOverride',{width:360,height:667,deviceScaleFactor:1,mobile:true});
  await browser.evaluate("document.querySelector('[aria-controls=student-navigation-mobile]').click()");
  await present('#student-navigation-mobile');
  const menu=await browser.evaluate(`(()=>{
    const header=document.querySelector('header').getBoundingClientRect();
    const nav=document.querySelector('#student-navigation-mobile').getBoundingClientRect();
    return {menuTop:nav.top,headerBottom:header.bottom};
  })()`);
  assert(menu.menuTop>=menu.headerBottom-2,'Mobile menu covers signed-in account header');
  await browser.evaluate("document.querySelector('[aria-controls=student-navigation-mobile]').click()");

  await fill({name:'Fixture Learner A2',learnerType:'child'},'#create-learner-form');
  await waitFor(async()=> (await profileNames()).length===2,'second owner profile');

  // #157: real native Chrome + Worker/D1 tests the NEW connected edit/archive controls.
  // These operations must not be considered successful from local React state alone.
  const secondProfile=await browser.evaluate("fetch('/v1/me/learners',{cache:'no-store'}).then(r=>r.json()).then(d=>d.learners.find(l=>l.name==='Fixture Learner A2'))");
  assert(secondProfile?.id && secondProfile.revision===1,'Second learner must have an active D1 revision');
  for(const [width,height] of [[360,667],[390,844],[768,1024],[1280,900],[1440,900]]) {
    await browser.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768});
    const layout=await browser.evaluate('({dir:document.documentElement.dir,overflow:document.documentElement.scrollWidth>innerWidth})');
    assert.equal(layout.dir,'rtl');assert.equal(layout.overflow,false,'Profile account overflow at '+width);
    await browser.screenshot('artifacts/auth-browser/profiles-'+width+'.png');
  }
  await browser.evaluate(`(()=>{
    const item=[...document.querySelectorAll('li')].find(li=>
      li.querySelector('strong')?.textContent==='Fixture Learner A2' &&
      [...li.querySelectorAll('button')].some(b=>b.textContent.trim()==='تعديل الاسم'));
    if(!item)throw Error('Rename UI missing');
    [...item.querySelectorAll('button')].find(b=>b.textContent.trim()==='تعديل الاسم').click();
  })()`);
  await present('form[id^="rename-profile-"] input[name="profileName"]');
  await browser.evaluate(`(()=>{
    const form=document.querySelector('form[id^="rename-profile-"]');
    form.querySelector('input[name="profileName"]').value='Fixture Learner A2 Updated';
    form.requestSubmit();
  })()`);
  await waitFor(async()=> (await profileNames()).includes('Fixture Learner A2 Updated'),'rename server ACK');
  const renamedProfile=await browser.evaluate(`fetch('/v1/me/learners',{cache:'no-store'})
    .then(r=>r.json()).then(d=>d.learners.find(l=>l.id===${JSON.stringify(secondProfile.id)}))`);
  assert.equal(renamedProfile?.name,'Fixture Learner A2 Updated');
  assert.equal(renamedProfile?.revision,2);
  const stale=await browser.evaluate(`fetch('/v1/me/learners/${secondProfile.id}/profile-actions',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'rename',operationId:crypto.randomUUID(),expectedRevision:1,name:'Stale Chrome Edit'})
  }).then(r=>r.status)`);
  assert.equal(stale,409,'Stale editor must never overwrite confirmed rename');

  await browser.go('/student/');await dashboard();
  assert.deepEqual(await profileNames(),['Fixture Learner A','Fixture Learner A2 Updated'],'Rename survives refresh');
  await browser.evaluate("(()=>{const select=document.querySelector('#learner-switch');select.value=select.options[1].value;select.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await waitFor(()=>browser.evaluate("document.querySelector('h1')?.textContent.includes('Fixture Learner A2 Updated')"),'sibling switch');
  await browser.go('/student/account/');await present('#create-learner-form');
  await browser.evaluate(`(()=>{
    const item=[...document.querySelectorAll('li')].find(li=>li.querySelector('strong')?.textContent==='Fixture Learner A2 Updated' &&
      [...li.querySelectorAll('button')].some(b=>b.textContent.trim()==='أرشفة الملف'));
    if(!item)throw Error('Archive UI missing');
    [...item.querySelectorAll('button')].find(b=>b.textContent.trim()==='أرشفة الملف').click();
  })()`);
  await present('[id^="archive-profile-"] button');
  await browser.evaluate(`(()=>{
    const container=document.querySelector('[id^="archive-profile-"]');
    [...container.querySelectorAll('button')].find(b=>b.textContent.trim()==='تأكيد الأرشفة').click();
  })()`);
  await waitFor(async()=> (await profileNames()).length===1,'archive server ACK');
  assert.deepEqual(await profileNames(),['Fixture Learner A']);
  const archivedDetail=await browser.evaluate(`fetch('/v1/learners/${secondProfile.id}',{cache:'no-store'}).then(r=>r.status)`);
  assert.equal(archivedDetail,404,'Archived student detail inaccessible via owner active endpoint');
  await browser.go('/student/');await dashboard();
  assert.deepEqual(await profileNames(),['Fixture Learner A'],'Archived learner absent after reload');
  assert.equal(await browser.evaluate("document.querySelector('h1')?.textContent.includes('Fixture Learner A')"),true);
  console.log('Native Chrome account: rename, stale edit 409, refresh, current-sibling archive, 404 archived, and responsive RTL PASS');
  assert.equal(await browser.evaluate("document.body.textContent.includes('شيخ تجريبي') || document.body.textContent.includes('DO NOT LOAD DEMO')"),false);
  await browser.evaluate("document.querySelector('#account-logout').click()");await hydrated();
  assert.equal(await browser.evaluate("document.querySelector('#learner-switch')===null"),true);
  assert.equal(await browser.evaluate("fetch('/api/auth/session',{cache:'no-store'}).then(r=>r.status)"),401);
  // Replay the revoked cookie in the isolated browser profile; the server must still deny it.
  await browser.send('Network.setCookies',{cookies:[{name:sessionCookie.name,value:sessionCookie.value,
    domain:sessionCookie.domain,path:sessionCookie.path,httpOnly:sessionCookie.httpOnly,secure:sessionCookie.secure,sameSite:sessionCookie.sameSite}]});
  await browser.go('/student/');await hydrated();
  assert.equal(await browser.evaluate("document.querySelector('#learner-switch')===null"),true);
  await browser.send('Network.clearBrowserCookies');
  await browser.evaluate("document.querySelector('#account-mode-switch').click()");await present('#auth-name');
  await fill({name:'Fixture Owner B',phoneNumber:'+12025550122',password,learnerName:'Fixture Learner B',learnerType:'adult'});
  await dashboard();
  assert.deepEqual(await profileNames(),['Fixture Learner B']);
  assert.equal(await browser.evaluate("document.body.textContent.includes('Fixture Learner A')"),false);
  await browser.evaluate("document.querySelector('#account-logout').click()");await hydrated();
  await fill({phoneNumber:'+12025550121',password:'incorrect-password'});
  await present('[role="alert"]');
  assert.equal(await browser.evaluate("document.querySelector('#learner-switch')===null"),true);
  await fill({phoneNumber:'+12025550121',password});await dashboard();
  assert.deepEqual(await profileNames(),['Fixture Learner A'],'Archived learner must remain hidden on new login');
  assert(process.env.NOOR_BROWSER_CONFIG&&process.env.NOOR_BROWSER_STATE);
  execFileSync('npx',['--yes','wrangler@4.45.0','d1','execute','noor-core-local','--config',process.env.NOOR_BROWSER_CONFIG,
    '--local','--persist-to',process.env.NOOR_BROWSER_STATE,'--command','UPDATE auth_sessions SET expires_at=0'],{stdio:'pipe'});
  await browser.go('/student/');await hydrated();
  assert.equal(await browser.evaluate("document.querySelector('#learner-switch')===null"),true);
  assert.equal(await browser.evaluate("document.body.textContent.includes('Fixture Learner A')"),false);
  console.log('Native browser + Worker/D1: partial signup recovery, real cookies, reload, sibling switch, logout replay, second-account separation, wrong password and expiry PASS');
} catch(error) {
  await browser.screenshot('artifacts/auth-browser/failure.png').catch(()=>{});
  throw error;
} finally { await browser.close(); }
