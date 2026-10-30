import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { setTimeout as sleep } from 'node:timers/promises';

export async function waitFor(check, description, attempts = 120) {
  for (let i=0; i<attempts; i++) {
    const result = await check();
    if (result) return result;
    await sleep(250);
  }
  throw Error('Timed out: '+description);
}
export function isNoorStagingOrigin(url) {
  return typeof url==='string' &&
    /^https:\/\/noor-site-staging\.[a-z0-9-]+\.workers\.dev\/$/.test(url);
}
export async function openNoorStagingChrome(url, options = {}) {
  if (!isNoorStagingOrigin(url)) throw Error('Only verified Noor development staging is allowed');
  // Fake devices are exclusively for explicit synthetic developer QA.
  // Never use real microphones/cameras in CI or in other environments.
  const syntheticMedia = options.syntheticMedia === true &&
    process.env.NOOR_SYNTHETIC_LIVEKIT_QA === 'true';
  return openChrome(url, syntheticMedia);
}
export async function openLocalChrome(url) {
  if (!/^http:\/\/127\.0\.0\.1:\d+\/$/.test(url)) throw Error('Local test origin required');
  return openChrome(url);
}
async function openChrome(url, syntheticMedia = false) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(),'noor-auth-chrome-'));
  const port = 45000 + Math.floor(Math.random()*4000);
  const child = spawn(process.env.CHROME_BIN || 'google-chrome',[
    '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
    '--no-proxy-server','--no-first-run','--no-default-browser-check','--disable-extensions',
    '--disable-background-networking',
    ...(syntheticMedia ? ['--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required'] : []),
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port='+port,'--remote-allow-origins=*','--user-data-dir='+profile,
  ],{stdio:['ignore','ignore','pipe']});
  let browserErrors = '';
  child.stderr?.on('data', chunk => { browserErrors = (browserErrors + chunk.toString()).slice(-4000); });
  let socket;
  async function close() {
    socket?.close();
    const exited = () => child.exitCode !== null || child.signalCode !== null;
    if (!exited()) {
      child.kill('SIGTERM');
      await Promise.race([new Promise(resolve => child.once('exit',resolve)),sleep(3000)]);
    }
    if (!exited()) {
      child.kill('SIGKILL');
      await Promise.race([new Promise(resolve => child.once('exit',resolve)),sleep(3000)]);
    }
    // The native browser journey must not fail because Chromium briefly keeps
    // updating cache files during process/profile teardown.
    try { fs.rmSync(profile,{recursive:true,force:true,maxRetries:12,retryDelay:250}); }
    catch (error) { console.warn('Chrome profile cleanup warning:', error?.code ?? String(error)); }
  }
  try {
    await waitFor(async()=>{
      if(child.exitCode!==null)throw Error('Chrome failed to start');
      try {return (await fetch('http://127.0.0.1:'+port+'/json/version',{signal:AbortSignal.timeout(1000)})).ok;}catch{return false;}
    },'Chrome startup',240);
    const target=await (await fetch('http://127.0.0.1:'+port+'/json/new?'+encodeURIComponent(url),{method:'PUT'})).json();
    socket=new globalThis.WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
    let sequence=0;
    const pending=new Map(), handlers=new Map();
    socket.addEventListener('message',event=>{
      const message=JSON.parse(event.data);
      if(message.id&&pending.has(message.id)) {
        const task=pending.get(message.id);pending.delete(message.id);
        if(message.error)task.reject(Error(JSON.stringify(message.error)));else task.resolve(message.result);
      } else if(handlers.has(message.method)) { void handlers.get(message.method)(message.params); }
    });
    const send=(method,params={})=>new Promise((resolve,reject)=>{
      const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));
    });
    const evaluate=async expression=>{
      const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
      if(result.exceptionDetails)throw Error('Browser assertion/evaluation failed: '+result.exceptionDetails.text);
      return result.result?.value;
    };
    await send('Page.enable');await send('Network.enable');
    return {send,evaluate,close,on:(method,handler)=>handlers.set(method,handler),
      go:async route=>{await send('Page.navigate',{url:url.slice(0,-1)+route});},
      screenshot:async destination=>{
        fs.mkdirSync(path.dirname(destination),{recursive:true});
        const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        fs.writeFileSync(destination,Buffer.from(result.data,'base64'));
      },
    };
  } catch(error) {
    const detail = error instanceof Error ? error.message : String(error);
    const diagnosis = 'Chrome exit='+child.exitCode+'; stderr='+browserErrors.slice(-3000);
    await close();throw Error(detail+'; '+diagnosis);
  }
}
