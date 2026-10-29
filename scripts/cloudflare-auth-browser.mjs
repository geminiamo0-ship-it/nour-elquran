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
    assert.equal(await browser.evaluate('document.documentElement.scrollWidth>innerWidth'),false,'Dashboard overflow at '+width);
    await browser.screenshot('artifacts/auth-browser/dashboard-'+width+'.png');
  }
  await browser.go('/student/account/');await present('#create-learner-form');
  await fill({name:'Fixture Learner A2',learnerType:'child'},'#create-learner-form');
  await waitFor(async()=> (await profileNames()).length===2,'second owner profile');
  await browser.go('/student/');await dashboard();
  await browser.evaluate("(()=>{const select=document.querySelector('#learner-switch');select.value=select.options[1].value;select.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await waitFor(()=>browser.evaluate("document.querySelector('h1')?.textContent.includes('Fixture Learner A2')"),'sibling switch');
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
  assert.deepEqual(await profileNames(),['Fixture Learner A','Fixture Learner A2']);
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
