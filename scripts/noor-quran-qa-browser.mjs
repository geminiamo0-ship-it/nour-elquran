import assert from 'node:assert/strict';
import {randomInt,randomUUID} from 'node:crypto';
import {openLocalChrome,waitFor} from './chrome-local.mjs';
const origin=process.env.NOOR_QA_ORIGIN, gate=process.env.NOOR_QA_ACCESS_PASSWORD;
if(!origin||!/^https:\/\/noor-site-quran-qa\.[a-z0-9-]+\.workers\.dev$/.test(origin)||!gate||gate.length<32)
  throw Error('Only password-gated Noor QA staging is allowed');
const browser=await openLocalChrome('http://127.0.0.1:8797/');
const pass='Fixture-Quran-'+randomUUID()+'Aa1!';
const auth=(name,phone)=>({name,phoneNumber:phone,password:pass,learnerName:name+' Learner',learnerType:'child'});
const evalJs=x=>browser.evaluate(x);
const go=p=>browser.send('Page.navigate',{url:origin+p});
const available=selector=>waitFor(()=>evalJs('Boolean(document.querySelector('+JSON.stringify(selector)+'))'),selector,200);
const op=(kind,itemId,payload,version=0,action='put')=>({operationId:randomUUID(),action,itemId,kind,page:1,expectedVersion:version,payload});
async function api(path,method='GET',body){
  const options={method,credentials:'same-origin',cache:'no-store'};
  if(body){options.headers={'content-type':'application/json'};options.body=JSON.stringify(body);}
  return evalJs('(async()=>{const r=await fetch('+JSON.stringify(path)+','+JSON.stringify(options)+');return {status:r.status,data:await r.json()};})()');
}
async function saved(){await waitFor(()=>evalJs("document.querySelector('[data-quran-save-status]')?.getAttribute('data-quran-save-status')==='saved'"),'confirmed private D1 save',200);}
async function signup(details){
  await available('#account-form');
  await waitFor(()=>evalJs("Object.keys(document.querySelector('#account-form')).some(k=>k.includes('reactProps'))"),'hydration');
  await evalJs("document.querySelector('#account-mode-switch').click()");
  await available('#auth-name');
  const ok=await evalJs('(()=>{const f=document.querySelector("#account-form");for(const [key,value] of Object.entries('+JSON.stringify(details)+')){const el=f.elements.namedItem(key);if(!el)return false;el.value=value;}f.requestSubmit();return true;})()');
  assert.equal(ok,true,'QA registration fields must exist');
  await available('#learner-switch');
  return evalJs("document.querySelector('#learner-switch').value");
}
try{
  browser.on('Fetch.authRequired',async e=>{await browser.send('Fetch.continueWithAuth',{
    requestId:e.requestId,authChallengeResponse:{response:'ProvideCredentials',username:'noor-preview',password:gate}
  }).catch(()=>{});});
  browser.on('Fetch.requestPaused',async e=>{await browser.send('Fetch.continueRequest',{requestId:e.requestId}).catch(()=>{});});
  await browser.send('Fetch.enable',{handleAuthRequests:true,patterns:[{urlPattern:origin+'/*',requestStage:'Request'}]});
  // The marketing landing has no sign-up form. AccountGate mounts on /student/.
  await go('/student/');
  const learner=await signup(auth('Synthetic Quran QA A','+1202'+randomInt(1000000,9999999)));
  assert.match(learner,/^[A-Za-z0-9-]{1,128}$/);
  const resource='/v1/me/learners/'+learner+'/mushaf';
  await go('/student/mushaf/');
  await available('[data-quran-save-status]');await saved();
  await evalJs('document.querySelector("button[title=\'قلم\']").click()');
  await available('svg[data-ink-mode="pen"]');
  const rect=await evalJs('(()=>{const r=document.querySelector("svg[data-ink-mode=pen]").getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()');
  assert(rect.w>80&&rect.h>150,'real Quran ink overlay size');
  const x=rect.x+rect.w*.3,y=rect.y+rect.h*.3;
  const drag=(type,xx,yy,buttons)=>browser.send('Input.dispatchMouseEvent',{
    type,x:xx,y:yy,button:type==='mouseMoved'?'none':'left',buttons,clickCount:1
  });
  await drag('mouseMoved',x,y,0);await drag('mousePressed',x,y,1);
  await drag('mouseMoved',x+25,y+25,1);await drag('mouseReleased',x+25,y+25,0);
  await waitFor(async()=>{const z=await api(resource+'?page=1');return z.status===200&&z.data.items.some(i=>i.kind==='pen');},'real pointer stroke D1 persist',200);
  await saved();
  for(const [kind,id,payload] of [
    ['marker','marker-'+randomUUID(),{points:[{x:120,y:200},{x:145,y:223}],color:'#86c5a8',width:16}],
    ['note','note-1-1-0',{target:{surah:1,ayah:1,wordIndex:null},text:'Synthetic Quran QA note',color:'#aabbcc'}],
    ['highlight','highlight-1-1-0',{target:{surah:1,ayah:1,wordIndex:null},color:'#f6cd46'}],
    ['bookmark','bookmark-1',{}],
  ]){
    const reply=await api(resource,'POST',op(kind,id,payload));
    assert.equal(reply.status,201,JSON.stringify(reply));
  }
  await go('/student/mushaf/');await saved();
  const paths=await evalJs("document.querySelectorAll('svg[data-ink-mode] path').length");
  assert(paths>=2,'pen and marker must be visible after page reload');
  await evalJs('document.querySelector("button[title=\'الملاحظات\']").click()');
  await waitFor(()=>evalJs("document.body.textContent.includes('Synthetic Quran QA note')"),'note restored after page reload');
  for(const width of [360,390,1280]){
    await browser.send('Emulation.setDeviceMetricsOverride',{width,height:width===360?667:width===390?844:900,deviceScaleFactor:1,mobile:width<600});
    await browser.screenshot('artifacts/quran-qa/reader-'+width+'.png');
  }
  let xhide=await api(resource,'POST',op('note','note-1-1-0',{},1,'hide'));
  assert.equal(xhide.status,201,JSON.stringify(xhide));
  await go('/student/mushaf/');await saved();
  const hidden=await api(resource+'?index=1');
  assert.equal(hidden.data.items.find(i=>i.itemId==='note-1-1-0')?.version,2);
  assert.equal(hidden.data.items.find(i=>i.itemId==='note-1-1-0')?.visible,false);
  const restored=await api(resource,'POST',op('note','note-1-1-0',{
    target:{surah:1,ayah:1,wordIndex:null},text:'Synthetic Quran QA note',color:'#aabbcc'
  },2));
  assert.equal(restored.status,201,JSON.stringify(restored));
  await evalJs("document.querySelector('#account-logout').click()");
  await available('#account-form');
  const other=await signup(auth('Synthetic Quran QA B','+1202'+randomInt(1000000,9999999)));
  assert.notEqual(other,learner);
  const denied=await api(resource+'?page=1');
  assert.equal(denied.status,404,'second household must have no access');
  console.log('PASS: password-gated Noor QA, real Chrome pen drag, D1 marker/note/highlight/bookmark, reload, notes, tombstone and restore, second-owner 404, mobile screenshots.');
}catch(error){
  await browser.screenshot('artifacts/quran-qa/failure.png').catch(()=>{});
  throw error;
}finally{await browser.close();}
