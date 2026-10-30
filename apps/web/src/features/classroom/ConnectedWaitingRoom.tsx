'use client';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';
import {LiveLessonMedia} from './LiveLessonMedia';
import {ReaderPrintedPage,clampQuranPage,targetKey,type QuranTarget} from '@/features/student';
import {ConnectedClassroomNotes} from './ConnectedClassroomNotes';
import css from './Classroom.module.css';
import liveCss from './ConnectedClassroom.module.css';

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
 const [selectedVerse,setSelectedVerse]=useState<QuranTarget|null>(null);
 const [panelOpen,setPanelOpen]=useState(false);
 const [compactToolbar,setCompactToolbar]=useState(false);
 const [focusMode,setFocusMode]=useState(false);
 const stageRef=useRef<HTMLDivElement>(null);
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

 if(identity===undefined)return <main dir="rtl" className={liveCss.boot}>
  <p role="status">جارٍ التحقق من غرفة الحصة…</p>
 </main>;
 if(identity===null||status==='denied')return <main dir="rtl" className={liveCss.boot}>
  <h1>رابط الحصة غير صالح</h1>
  <p>افتح الحصة المصرح بها من جدول الشيخ أو الطالب؛ لا يمنح الرابط أي صلاحيات.</p>
  <Link href="/student">العودة للبوابة</Link>
 </main>;
 const role=identity.role==='learner'?'student':'teacher';
 const changePage=(next:number)=>{
  setLocalPage(clampQuranPage(next));
  setSelectedVerse(null);
 };
 return <div ref={stageRef}
  className={[css.root,liveCss.connected,focusMode?css.focusMode:'',
   panelOpen?css.panelExpanded:'',compactToolbar?css.toolbarCollapsed:''].filter(Boolean).join(' ')}
  data-view-role={role} data-focus={focusMode?'on':'off'} data-classroom-connected="true"
  dir="rtl" aria-label="الفصل القرآني المتصل">
  <div className={css.pageTop}>
   <Link href={role==='teacher'?'/teacher/schedule':'/student/lessons'}>العودة إلى {role==='teacher'?'بوابة الشيخ':'بوابة الطالب'}</Link>
   <span className={css.previewDisclosure}>غرفة خاصة · حساب موثق · بدون تسجيل</span>
   <div className={css.workspaceActions}>
    <button type="button" className={css.focusButton} aria-pressed={focusMode}
     onClick={()=>void toggleFocus()}>{focusMode?'الخروج من وضع الحصة':'⛶ وضع الحصة'}</button>
    {role==='teacher'&&<button type="button" className={css.panelToggle}
     aria-expanded={panelOpen} aria-controls="lesson-notes"
     onClick={()=>setPanelOpen(p=>!p)}>{panelOpen?'إخفاء لوحة الأدوات':'الأخطاء والتقييم'}</button>}
    <button type="button" className={css.toolbarToggle} aria-expanded={!compactToolbar}
     onClick={()=>setCompactToolbar(v=>!v)}>
     {compactToolbar?'إظهار الأدوات الإضافية':'إخفاء الأدوات الإضافية'}
    </button>
   </div>
  </div>
  <div className={css.topline}>
   <div className={css.lessonTitle}>
    <h1>الفصل التفاعلي</h1>
    <span className={css.demoTag}>اتصال موثق · LiveKit</span>
   </div>
   <div className={css.topControls}>
    <span className={css.workspaceIdentity}>
     {role==='teacher'?'منظور الشيخ':'منظور الطالب'}
    </span>
    <span className={joined?css.stateLive:css.stateWaiting}>
     {joined?'داخل غرفة الانتظار':'بانتظار الانضمام'}
    </span>
   </div>
  </div>
  <section className={css.prejoinCard} aria-label="حالة طرفي الحصة">
   <div className={css.prejoinPeople}>
    <strong className={css.presenceHeading}>حالة الطرفين</strong>
    <span className={liveCss.actor} data-online={presence?.teacherPresent?'true':'false'}>
     ● الشيخ {presence?.teacherPresent?'متصل':'غير متصل'}
    </span>
    <span className={liveCss.actor} data-online={presence?.learnerPresent?'true':'false'}>
     ● الطالب {presence?.learnerPresent?'متصل':'غير متصل'}
    </span>
    <span className={liveCss.status} role="status">
     {status==='loading'?'جارٍ التحقق…':
      joined?(presence?.bothPresent?'الطرفان في غرفة الانتظار':'بانتظار الطرف الآخر'):'غرفة انتظار خاصة'}
    </span>
   </div>
   <div className={css.prejoinActions}>
    <button className={css.primaryBtn} type="button" disabled={busy||status!=='ready'}
     onClick={()=>void refresh(joined?'leave':'join')}>
     {busy?'جارٍ تأكيد العملية…':joined?'مغادرة غرفة الانتظار':'الانضمام لغرفة الانتظار'}
    </button>
    <button className={liveCss.refresh} type="button" disabled={busy}
     onClick={()=>void refresh('snapshot')}>تحديث الحالة</button>
   </div>
  </section>
  {error&&<p className={liveCss.error} role="alert">{error}</p>}
  <div className={css.toolbar} role="toolbar" aria-label="أدوات المصحف">
   <div className={css.toolGroup}>
    <span className={liveCss.readOnlyLabel}>الآيات</span>
    {([{symbol:'⌖',name:'تحديد الآية'},{symbol:'✎',name:'قلم'},
      {symbol:'▰',name:'تظليل'},{symbol:'⌫',name:'ممحاة'}] as const).map((item,i)=>
     <button key={item.name} type="button" title={i===0?'تحديد آية للقراءة فقط':
      item.name+' غير مفعل حتى اعتماد التزامن'}
      disabled={i!==0} aria-pressed={false} onClick={()=>{if(i===0)setSelectedVerse(null);}}>
      <span aria-hidden="true">{item.symbol}</span>{item.name}
     </button>)}
   </div>
   <div className={css.colors} aria-label="ألوان التظليل غير مفعلة">
    {['#d0a94c','#388e68','#e2604e','#397ca7','#8d67b0'].map(color=>
     <button key={color} type="button" className={css.color} style={{background:color}}
      disabled title="يُفعّل بعد التزامن" aria-label={'لون '+color+' غير متاح'}/>)}
   </div>
   <div className={css.toolGroup}>
    <button type="button" disabled={localPage<=1}
     onClick={()=>changePage(localPage-1)}>صفحة سابقة ↑</button>
    <span>صفحة {localPage} / 604</span>
    <button type="button" disabled={localPage>=604}
     onClick={()=>changePage(localPage+1)}>صفحة تالية ↓</button>
   </div>
   <span className={liveCss.localTag}>تصفح محلي</span>
  </div>
  <div className={css.workspace}>
   <aside className={[css.mediaPanel,liveCss.mediaPanel].join(' ')} aria-label="لوحة فيديو المشاركين">
    <header className={css.mediaHead}><strong>المشاركون</strong>
     <span>{joined?'غرفة صوت وفيديو حقيقية':'الكاميرا مغلقة'}</span>
    </header>
    {joined&&status==='ready'?<LiveLessonMedia identity={identity} active={joined} embedded/>:
     <div className={css.videoOffline}>
      <strong>كاميرا {role==='teacher'?'الطالب':'الشيخ'} غير متصلة</strong>
      <span>انضم إلى غرفة الانتظار لبدء الاتصال الآمن.</span>
      <span>لا تُفتح الكاميرا أو الميكروفون تلقائيًا.</span>
     </div>}
   </aside>
   <main className={css.quranStage} aria-label="المصحف داخل الفصل">
    <header className={css.quranHead}>
     <div><span className={css.overline}>المصحف المعتمد · رواية حفص</span>
      <h2>المصحف المشترك</h2></div>
     <span className={css.quranStatus}>تصفح محلي · التزامن لم يُفعّل</span>
    </header>
    <div className={css.quranViewport} data-quran-layout="viewport-fit">
     <button type="button" className={css.pageEdgePrev} title="الصفحة السابقة" aria-label="الصفحة السابقة"
      disabled={localPage<=1} onClick={()=>changePage(localPage-1)}>‹</button>
     <ReaderPrintedPage page={localPage} viewportFit inkMode="off" color="#d0a94c"
      strokes={[]} selectedKey={selectedVerse?targetKey(selectedVerse):null}
      noteKeys={new Set<string>()}
      onSelect={setSelectedVerse} onOpenNote={setSelectedVerse} onInkChange={()=>{}}/>
     <button type="button" className={css.pageEdgeNext} title="الصفحة التالية" aria-label="الصفحة التالية"
      disabled={localPage>=604} onClick={()=>changePage(localPage+1)}>›</button>
    </div>
    <footer className={css.quranFooter}>
     <span>الصفحة {localPage} من ٦٠٤ · العرض والتحديد محليان حتى ربط التزامن</span>
     {selectedVerse&&<span>الآية المختارة محليًا: {selectedVerse.surah}:{selectedVerse.ayah}</span>}
    </footer>
   </main>
   <div className={css.panelSlot} id="lesson-notes" data-open={panelOpen?'true':'false'}>
    <ConnectedClassroomNotes role={role} page={localPage} selectedVerse={selectedVerse}/>
   </div>
  </div>
  <p className={[css.disclaimer,liveCss.disclaimer].join(' ')}>
   المصحف والتحديد محليان الآن، ولا تُحفظ علامات أو تقارير. الصوت والفيديو عبر LiveKit بموافقتك.
  </p>
 </div>;
}
