'use client';
import {useEffect,useRef} from 'react';
import type {ConnectedIdentity} from './live-ink';

/** Read-only authenticated hints: never send strokes, cookies or role grants
 * over this socket. All writes remain signed HTTP + DO CAS and D1 outbox. */
export type LessonHint=Readonly<{
 type:'quran-page'|'quran-ink';page:number;revision:number;
}>;
export function validLessonHint(value:unknown):value is LessonHint{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const x=value as Record<string,unknown>;
 return Object.keys(x).length===3&&
  (x.type==='quran-page'||x.type==='quran-ink')&&
  Number.isInteger(x.page)&&Number(x.page)>=1&&Number(x.page)<=604&&
  Number.isSafeInteger(x.revision)&&Number(x.revision)>=0;
}
export function realtimePath(id:ConnectedIdentity):string{
 const lesson=encodeURIComponent(id.lessonId);
 return id.role==='teacher'?'/v1/teacher/lessons/'+lesson+'/realtime':
  '/v1/me/learners/'+encodeURIComponent(id.learnerId!)+'/lessons/'+lesson+'/realtime';
}
/** Cloudflare DO WebSocket is a low-delay *hint*, never the persistence ACK.
 * Signed polling stays enabled as a fallback for interruption/revocation. */
export function useLessonRealtime(
 identity:ConnectedIdentity|null|undefined,joined:boolean,
 onHint:(hint:LessonHint)=>void,onReconnect:()=>void
):void{
 const onHintRef=useRef(onHint),onReconnectRef=useRef(onReconnect);
 onHintRef.current=onHint;onReconnectRef.current=onReconnect;
 useEffect(()=>{
  if(!identity||!joined||typeof WebSocket==='undefined')return;
  let stopped=false,socket:WebSocket|null=null,timer:number|undefined,backoff=500;
  const lastSeen=new Map<string,number>();
  const clear=()=>{if(timer!==undefined){window.clearTimeout(timer);timer=undefined;}};
  const connect=()=>{
   clear();
   if(stopped||document.visibilityState==='hidden')return;
   const protocol=window.location.protocol==='https:'?'wss:':'ws:';
   let ws:WebSocket;
   try{ws=new WebSocket(protocol+'//'+window.location.host+realtimePath(identity));}
   catch{schedule();return;}
   socket=ws;
   ws.onopen=()=>{
    if(stopped||socket!==ws)return;
    backoff=500;
    // Reconcile missed DO events after a transport interruption.
    lastSeen.clear();onReconnectRef.current();
   };
   ws.onmessage=(event)=>{
    if(stopped||socket!==ws||typeof event.data!=='string'||event.data.length>240)return;
    let value:unknown;
    try{value=JSON.parse(event.data);}catch{return;}
    if(!validLessonHint(value))return;
    const key=value.type+':'+value.page;
    if((lastSeen.get(key)??-1)>=value.revision)return;
    lastSeen.set(key,value.revision);
    onHintRef.current(value);
   };
   ws.onclose=()=>{if(socket===ws)socket=null;schedule();};
   ws.onerror=()=>{/* close handler retries; polling remains active */};
  };
  const schedule=()=>{
   if(stopped||timer!==undefined||document.visibilityState==='hidden')return;
   timer=window.setTimeout(()=>{timer=undefined;connect();},backoff);
   backoff=Math.min(15_000,Math.round(backoff*1.7));
  };
  const visible=()=>{
   if(document.visibilityState==='hidden'){
    clear();const old=socket;socket=null;
    if(old)old.close(1000,'hidden');
   }else if(!socket)connect();
  };
  document.addEventListener('visibilitychange',visible);
  connect();
  return()=>{
   stopped=true;clear();document.removeEventListener('visibilitychange',visible);
   const old=socket;socket=null;
   if(old)old.close(1000,'left lesson');
  };
 },[identity?.lessonId,identity?.learnerId,identity?.role,joined]);
}
