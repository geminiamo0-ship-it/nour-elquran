'use client';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';

type Identity=Readonly<{role:'teacher'|'learner';lessonId:string;learnerId?:string}>;
type Presence=Readonly<{
 lessonId:string;teacherPresent:boolean;learnerPresent:boolean;bothPresent:boolean;
 revision:number;leaseTtlMs:number;canStart:false;mediaReady:false;
}>;
type Display='loading'|'ready'|'denied'|'error';
const valid=/^[A-Za-z0-9-]{1,128}$/;
function route(identity:Identity){
 if(identity.role==='teacher')return '/v1/teacher/lessons/'+encodeURIComponent(identity.lessonId);
 return '/v1/me/learners/'+encodeURIComponent(identity.learnerId!)+
  '/lessons/'+encodeURIComponent(identity.lessonId);
}
function readIdentity():Identity|null {
 const p=new URLSearchParams(window.location.search);
 const lessonId=p.get('lessonId'),role=p.get('role'),learnerId=p.get('learnerId');
 if(!lessonId||!valid.test(lessonId))return null;
 if(role==='teacher'&&!learnerId)return {role,lessonId};
 if(role==='learner'&&learnerId&&valid.test(learnerId))return {role,lessonId,learnerId};
 return null;
}
function safePresence(data:unknown,lessonId:string):Presence {
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('INVALID_ROOM_RESPONSE');
 const root=data as Record<string,unknown>;
 const p=root.presence;
 if(!p||typeof p!=='object'||Array.isArray(p))throw Error('INVALID_ROOM_RESPONSE');
 const s=p as Record<string,unknown>;
 if(s.lessonId!==lessonId||typeof s.teacherPresent!=='boolean'||
  typeof s.learnerPresent!=='boolean'||s.bothPresent!==(s.teacherPresent&&s.learnerPresent)||
  !Number.isSafeInteger(s.revision)||typeof s.leaseTtlMs!=='number'||
  s.leaseTtlMs<1||s.leaseTtlMs>60_000||s.canStart!==false||s.mediaReady!==false)
  throw Error('INVALID_ROOM_RESPONSE');
 return s as Presence;
}
function errorText(code:string){
 if(code==='NOT_JOINED')return 'انتهى الاتصال بالغرفة؛ انضم مجددًا.';
 if(code==='ROOM_ACTOR_CONFLICT')return 'هذه الجهة متصلة في نفس الغرفة من حساب مختلف.';
 if(code==='NOT_FOUND'||code==='UNAUTHENTICATED')
  return 'الحصة غير متاحة لهذا الحساب، أو انتهت صلاحية الدخول.';
 if(code==='CLASSROOM_ROOM_NOT_CONFIGURED'||code==='CLASSROOM_ROOM_UNAVAILABLE')
  return 'خدمة الغرفة غير مفعلة حاليًا على هذه البيئة.';
 return 'تعذر تأكيد الاتصال؛ لن نسجل حضورًا افتراضيًا.';
}
async function call(id:Identity,action:'snapshot'|'join'|'heartbeat'|'leave',signal?:AbortSignal){
 const url=route(id)+(action==='snapshot'?'/presence':'/presence-actions');
 const response=await fetch(url,{method:action==='snapshot'?'GET':'POST',
  ...(action==='snapshot'?{}:{headers:{'content-type':'application/json'},
    body:JSON.stringify({action})}),credentials:'same-origin',cache:'no-store',
  redirect:'error',signal});
 let parsed:unknown;
 try{parsed=await response.json();}catch{throw Error('INVALID_ROOM_RESPONSE');}
 if(!response.ok){
  const value=parsed&&typeof parsed==='object'&&!Array.isArray(parsed)
   ?(parsed as Record<string,unknown>).code:undefined;
  throw Error(typeof value==='string'?value:'ROOM_REQUEST_FAILED');
 }
 return safePresence(parsed,id.lessonId);
}
/**
 * This is a signed waiting room, not a live Classroom. Page load only reads
 * status; the participant must explicitly click Join. No media or attendance.
 */
export function ConnectedWaitingRoom(){
 const [identity,setIdentity]=useState<Identity|null|undefined>(undefined);
 const [status,setStatus]=useState<Display>('loading');
 const [presence,setPresence]=useState<Presence|null>(null);
 const [joined,setJoined]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const running=useRef(false);
 const alive=useRef(true);
 useEffect(()=>{
  const id=readIdentity();
  setIdentity(id);
  if(!id){setStatus('denied');return;}
  const controller=new AbortController();
  void call(id,'snapshot',controller.signal).then(p=>{
   if(controller.signal.aborted)return;
   setPresence(p);setStatus('ready');
  }).catch(e=>{
   if(controller.signal.aborted)return;
   setStatus('error');setError(errorText(e instanceof Error?e.message:'UNKNOWN'));
  });
  return()=>{controller.abort();};
 },[]);
 useEffect(()=>{
  alive.current=true;
  return ()=>{alive.current=false;};
 },[]);
 const refresh=useCallback(async(action:'snapshot'|'join'|'heartbeat'|'leave')=>{
  if(!identity||running.current)return;
  running.current=true;
  if(action==='join'||action==='leave')setBusy(true);
  try{
   const p=await call(identity,action);
   if(!alive.current)return;
   setPresence(p);setStatus('ready');setError('');
   if(action==='join')setJoined(true);
   if(action==='leave')setJoined(false);
  }catch(e){
   if(!alive.current)return;
   const code=e instanceof Error?e.message:'UNKNOWN';
   setError(errorText(code));
   if(action!=='snapshot'||code==='NOT_FOUND'||code==='UNAUTHENTICATED')
    setJoined(false);
   if(action==='heartbeat'&&code==='NOT_JOINED')setPresence(null);
  }finally{running.current=false;if(alive.current)setBusy(false);}
 },[identity]);
 useEffect(()=>{
  if(!identity||!joined)return;
  const timer=window.setInterval(()=>{
   if(document.visibilityState==='visible')void refresh('heartbeat');
  },8_000);
  // Snapshots/presence cannot auto-start/end any lesson, even if both are online.
  return()=>window.clearInterval(timer);
 },[identity,joined,refresh]);
 if(identity===undefined)return <main dir="rtl" style={{maxWidth:760,margin:'2rem auto',padding:24}}>
  <p role="status">جارٍ التحقق من غرفة الانتظار…</p></main>;
 if(identity===null||status==='denied')return <main dir="rtl" style={{maxWidth:760,margin:'2rem auto',padding:24}}>
  <h1>رابط غرفة الانتظار غير صالح</h1>
  <p>افتح الحصة المصرح بها من جدول الطالب أو الشيخ؛ لا يمكن اختيار دور أو حساب آخر من هذه الصفحة.</p>
  <Link href="/student">العودة للبوابة</Link></main>;
 return <main dir="rtl" style={{maxWidth:760,margin:'2rem auto',padding:24,display:'grid',gap:16}}>
  <header><h1>غرفة انتظار الحصة</h1>
   <p>غرفة Cloudflare خاصة بالحصة · {identity.role==='teacher'?'منظور الشيخ':'منظور الطالب'}</p></header>
  <p>الانضمام هنا يؤكد اتصال حسابك بغرفة الانتظار فقط. لا يبدأ الحصة، ولا يشغّل الكاميرا أو الميكروفون، ولا يسجّل حضورًا رسميًا.</p>
  {status==='loading'?<p role="status">جارٍ تحميل حالة غرفة الانتظار الموثقة…</p>:
   <section aria-label="حالة طرفي الحصة" style={{padding:20,border:'1px solid #aaa',borderRadius:12}}>
    <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
     <p><strong>الشيخ:</strong> {presence?.teacherPresent?'متصل بغرفة الانتظار':'غير متصل'}</p>
     <p><strong>الطالب:</strong> {presence?.learnerPresent?'متصل بغرفة الانتظار':'غير متصل'}</p>
    </div>
    <p role="status">{joined?'أنت متصل بالغرفة.':'لم تنضم إلى الغرفة بعد.'}</p>
    <p>{presence?.bothPresent?'الطرفان متصلان، لكن بدء الدرس لم يُفعّل بعد.':'بانتظار اكتمال اتصال الطرفين.'}</p>
   </section>}
  {error&&<p role="alert">{error}</p>}
  <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
   <button type="button" disabled={busy||status!=='ready'} onClick={()=>void refresh(joined?'leave':'join')}>
    {busy?'جارٍ تأكيد العملية…':joined?'مغادرة غرفة الانتظار':'الانضمام لغرفة الانتظار'}
   </button>
   <button type="button" disabled={busy} onClick={()=>void refresh('snapshot')}>تحديث الحالة</button>
   <Link href={identity.role==='teacher'?'/teacher/schedule':'/student/lessons'}>العودة للجدول</Link>
  </div>
  <p>الصوت والفيديو عبر LiveKit Cloud، والتزامن والمصحف وتوثيق بدء/إنهاء الحصة، مراحل منفصلة لم تُفعّل بعد. لا توجد محاكاة حضور هنا.</p>
 </main>;
}
