'use client';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';
import {LiveLessonMedia} from './LiveLessonMedia';
import {SmoothMadinahPage,clampQuranPage} from '@/features/student';
import css from './LiveClassroom.module.css';

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
 const [localPage,setLocalPage]=useState(1);
 const [focusMode,setFocusMode]=useState(false);
 const stageRef=useRef<HTMLElement>(null);
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
  const sync=()=>{if(!document.fullscreenElement)setFocusMode(false);};
  document.addEventListener('fullscreenchange',sync);
  return()=>document.removeEventListener('fullscreenchange',sync);
 },[]);
 const toggleFocus=useCallback(async()=>{
  if(document.fullscreenElement){await document.exitFullscreen().catch(()=>undefined);setFocusMode(false);}
  else if(stageRef.current?.requestFullscreen){
   await stageRef.current.requestFullscreen().then(()=>setFocusMode(true)).catch(()=>undefined);
  }
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
 if(identity===undefined)return <main dir="rtl" className={css.boot}><p role="status">جارٍ التحقق من غرفة الحصة…</p></main>;
 if(identity===null||status==='denied')return <main dir="rtl" className={css.boot}>
  <h1>رابط الحصة غير صالح</h1>
  <p>افتح الحصة المصرح بها من جدول الشيخ أو الطالب. هذا الرابط لا يمنح أي صلاحيات بمفرده.</p>
  <Link href="/student">العودة للبوابة</Link>
 </main>;
 return <main ref={stageRef} className={css.root} dir="rtl" data-live-role={identity.role}
   data-focus={focusMode?'on':'off'} aria-label="الفصل القرآني المتصل">
  <header className={css.head}>
   <div className={css.brand}>
    <strong>نور القرآن</strong>
    <span aria-hidden="true" className={css.headDivider}>/</span>
    <span>{identity.role==='teacher'?'منظور الشيخ':'منظور الطالب'}</span>
   </div>
   <div className={css.headActions}>
    <span className={css.authenticated}>غرفة خاصة · دخول موثق</span>
    <button type="button" className={css.headButton} aria-pressed={focusMode}
      onClick={()=>void toggleFocus()}>{focusMode?'الخروج من وضع الحصة':'⛶ وضع الحصة'}</button>
    <Link href={identity.role==='teacher'?'/teacher/schedule':'/student/lessons'}>الجدول</Link>
   </div>
  </header>
  <section className={css.presenceStrip} aria-label="حالة طرفي الحصة">
   <div className={css.actors}>
    <span data-presence={presence?.teacherPresent?'online':'offline'}>● الشيخ {presence?.teacherPresent?'متصل':'غير متصل'}</span>
    <span data-presence={presence?.learnerPresent?'online':'offline'}>● الطالب {presence?.learnerPresent?'متصل':'غير متصل'}</span>
   </div>
   <span className={css.waitingText} role="status">
    {status==='loading'?'جارٍ تحميل حالة الغرفة…':
     joined?(presence?.bothPresent?'الطرفان في غرفة الانتظار':'بانتظار الطرف الآخر'):'لم تنضم إلى الغرفة بعد'}
   </span>
   <div className={css.presenceActions}>
    <button className={css.joinButton} type="button" disabled={busy||status!=='ready'}
     onClick={()=>void refresh(joined?'leave':'join')}>
     {busy?'جارٍ التأكيد…':joined?'مغادرة غرفة الانتظار':'الانضمام لغرفة الانتظار'}
    </button>
    <button className={css.secondaryButton} type="button" disabled={busy}
     onClick={()=>void refresh('snapshot')}>تحديث</button>
   </div>
  </section>
  {error&&<p className={css.error} role="alert">{error}</p>}
  <div className={css.workspace}>
   <section className={css.quranStage} aria-label="المصحف داخل الحصة">
    <header className={css.quranHead}>
     <h1>المصحف الشريف <small>رواية حفص</small></h1>
     <span className={css.localBadge}>تصفح شخصي · غير متزامن حاليًا</span>
    </header>
    <div className={css.quranViewport} data-quran-layout="viewport-fit">
     <SmoothMadinahPage page={localPage} viewportFit/>
    </div>
    <nav className={css.pageNav} aria-label="تصفح صفحات المصحف محليًا">
     <button type="button" disabled={localPage<=1} onClick={()=>setLocalPage(p=>clampQuranPage(p-1))}>السابقة</button>
     <span>الصفحة {localPage} / 604</span>
     <button type="button" disabled={localPage>=604} onClick={()=>setLocalPage(p=>clampQuranPage(p+1))}>التالية</button>
    </nav>
   </section>
   <aside className={css.mediaDock} aria-label="لوحة كاميرات الحصة">
    {joined&&status==='ready'?<LiveLessonMedia identity={identity} active={joined}/>:
     <div className={css.mediaWaiting}>
      <strong>كاميرا {identity.role==='learner'?'الشيخ':'الطالب'}</strong>
      <span>{status==='loading'?'جارٍ التحقق من صلاحية الغرفة…':
       'انضم لغرفة الانتظار لعرض وسائل الاتصال الحقيقية.'}</span>
      <small>الكاميرا والميكروفون لا يعملان تلقائيًا</small>
     </div>}
   </aside>
  </div>
  <footer className={css.disclosure}>
   عرض المصحف هنا محلي، وليس صفحة مشتركة حتى الآن. لا يتم تسجيل حضور أو بث أو تصحيحات تلقائيًا.
  </footer>
 </main>;
}
