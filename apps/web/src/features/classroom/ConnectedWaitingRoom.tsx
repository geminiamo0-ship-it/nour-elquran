'use client';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';
import {SignedClassroomStage} from './SignedClassroomStage';
import css from './SignedClassroom.module.css';

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
 return <main dir="rtl" className={css.shell}>
  <header className={css.header}>
    <div><strong>الحصة المباشرة</strong>
      <small>{identity.role==='teacher'?'منظور الشيخ':'منظور الطالب'} · دخول موثق</small></div>
    <Link href={identity.role==='teacher'?'/teacher/schedule':'/student/lessons'}>العودة للجدول</Link>
  </header>
  <div className={css.lobbyBar}>
    <span role="status" className={css.roomStatus}>
      {joined?'متصل بغرفة الانتظار':status==='loading'?'جارٍ التحقق…':'لم تنضم بعد'}
    </span>
    <button type="button" disabled={busy||status!=='ready'}
      onClick={()=>void refresh(joined?'leave':'join')}>
      {busy?'جارٍ التأكيد…':joined?'مغادرة الغرفة':'الانضمام للحصة'}
    </button>
    <button type="button" disabled={busy} onClick={()=>void refresh('snapshot')}>تحديث</button>
    <details className={css.presenceDetails}>
      <summary>حالة الطرفين</summary>
      <div className={css.presencePopover}>
        <p>الشيخ: {presence?.teacherPresent?'متصل':'غير متصل'}</p>
        <p>الطالب: {presence?.learnerPresent?'متصل':'غير متصل'}</p>
        <p>{presence?.bothPresent?'الطرفان متصلان بالغرفة.':'بانتظار اكتمال اتصال الطرفين.'}</p>
        <p>الاتصال بالغرفة لا يبدأ الحصة ولا يسجل حضورًا رسميًا.</p>
      </div>
    </details>
  </div>
  {error&&<p role="alert" className={css.alert}>{error}</p>}
  {joined&&status==='ready'
    ?<SignedClassroomStage identity={identity} active={joined}/>
    :<section className={css.prejoin} aria-label="قبل دخول الحصة">
      <h1>المصحف والكاميرا في شاشة واحدة</h1>
      <p>انضم أولًا لغرفة الحصة المصرح بها. الكاميرا والميكروفون يظلان مغلقين حتى تختار تشغيلهما بنفسك.</p>
      <p>{status==='loading'?'جارٍ تحميل حالة غرفة الانتظار الموثقة…':
        'لا يبدأ الدرس رسميًا بمجرد دخول الغرفة.'}</p>
    </section>}
  <p className={css.legal}>
    لا تسجيل صوت أو فيديو ولا حضور تلقائي. تزامن صفحة المصحف والرسم وأرشيف الحصة قيد التنفيذ.
  </p>
 </main>;
}
