'use client';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';
import {LiveLessonMedia} from './LiveLessonMedia';
import {LiveLessonLifecycle} from './LiveLessonLifecycle';
import {ReaderPrintedPage,clampQuranPage,targetKey,type QuranTarget,type QuranInkStroke} from '@/features/student';
import {fetchLiveInk,compactStroke,type InkView} from './live-ink';
import {ConnectedClassroomNotes} from './ConnectedClassroomNotes';
import {QuranVersePicker} from './QuranVersePicker';
import {isVerseSelection,type VerseSelection} from './quran-verse-selection';
import css from './Classroom.module.css';
import liveCss from './ConnectedClassroom.module.css';
import barCss from './ClassroomSessionHeader.module.css';

type Identity=Readonly<{role:'teacher'|'learner';lessonId:string;learnerId?:string}>;
type Presence=Readonly<{
 lessonId:string;teacherPresent:boolean;learnerPresent:boolean;bothPresent:boolean;
 revision:number;leaseTtlMs:number;canStart:false;mediaReady:false;
}>;
type Display='loading'|'ready'|'denied'|'error';
type SharedPage=Readonly<{edition:'hafs-kfqc-v1.1.1';page:number;revision:number;verse?:VerseSelection}>;
type PageResult=Readonly<{code:string;quran:SharedPage}>;
function validPage(raw:unknown):raw is SharedPage{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 const p=raw as Record<string,unknown>;
 return (Object.keys(p).length===3||
  (Object.keys(p).length===4&&isVerseSelection(p.verse)))&&
  p.edition==='hafs-kfqc-v1.1.1'&&
  Number.isInteger(p.page)&&Number(p.page)>=1&&Number(p.page)<=604&&
  Number.isSafeInteger(p.revision)&&Number(p.revision)>=0;
}
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
async function callPage(id:Identity,change?:Readonly<{
 page:number;expectedRevision:number;requestId:string;verse?:VerseSelection;
}>):Promise<PageResult>{
 const response=await fetch(route(id)+'/quran-page',{
  method:change?'POST':'GET',
  ...(change?{headers:{'content-type':'application/json'},
   body:JSON.stringify({action:'set',...change})}:{}),
  credentials:'same-origin',cache:'no-store',redirect:'error'
 });
 let raw:unknown;
 try{raw=await response.json();}catch{throw Error('INVALID_QURAN_PAGE_RESPONSE');}
 const p=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:null;
 if((response.ok||response.status===409)&&p&&validPage(p.quran)&&
  ['QURAN_PAGE_SNAPSHOT','QURAN_PAGE_SET','QURAN_PAGE_REPLAY','QURAN_PAGE_CONFLICT'].includes(String(p.code)))
  return {code:String(p.code),quran:p.quran};
 throw Error(typeof p?.code==='string'?p.code:'CLASSROOM_QURAN_UNAVAILABLE');
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
 const [lessonPhase,setLessonPhase]=useState<'scheduled'|'live'|'completed'|'cancelled'|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [sharedPage,setSharedPage]=useState<SharedPage|null>(null);
 const [pageBusy,setPageBusy]=useState(false);
 const [ink,setInk]=useState<InkView|null>(null);
 const [inkBusy,setInkBusy]=useState(false);
 const [inkError,setInkError]=useState('');
 const [inkMode,setInkMode]=useState<'off'|'pen'|'marker'|'eraser'>('off');
 const [inkColor,setInkColor]=useState('#d0a94c');
 const inkPollBusy=useRef(false);
 const [pageError,setPageError]=useState('');
 const pagePollBusy=useRef(false);
 const [panelOpen,setPanelOpen]=useState(false);
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

 useEffect(()=>{
  if(!identity||!joined){setSharedPage(null);setPageError('');return;}
  let enabled=true;
  const poll=async()=>{
   if(pagePollBusy.current||document.visibilityState==='hidden')return;
   pagePollBusy.current=true;
   try{
    const response=await callPage(identity);
    if(!enabled)return;
    setSharedPage(prev=>prev&&prev.revision>response.quran.revision?prev:response.quran);
    setPageError('');
   }catch{if(enabled)setPageError('تعذّر تحديث الصفحة المشتركة، وسنعيد المحاولة تلقائيًا.');}
   finally{pagePollBusy.current=false;}
  };
  void poll();
  const timer=window.setInterval(()=>void poll(),2_000);
  const visible=()=>{if(document.visibilityState==='visible')void poll();};
  document.addEventListener('visibilitychange',visible);
  return()=>{enabled=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[identity,joined]);
 useEffect(()=>{
  if(!identity||!joined||!sharedPage){
   setInk(null);setInkMode('off');setInkError('');return;
  }
  const currentPage=sharedPage.page;
  let enabled=true;
  setInk(null);setInkMode('off');
  const poll=async()=>{
   if(inkPollBusy.current||document.visibilityState==='hidden')return;
   inkPollBusy.current=true;
   try{
    const response=await fetchLiveInk(identity,currentPage);
    if(!enabled)return;
    setInk(previous=>previous&&previous.page===response.ink.page&&
      previous.revision>response.ink.revision?previous:response.ink);
    setInkError('');
   }catch{
    if(enabled)setInkError('تعذّر تحديث علامات الحصة؛ سنعيد المحاولة.');
   }finally{inkPollBusy.current=false;}
  };
  void poll();
  const timer=window.setInterval(()=>void poll(),2_000);
  const visibility=()=>{if(document.visibilityState==='visible')void poll();};
  document.addEventListener('visibilitychange',visibility);
  return()=>{enabled=false;window.clearInterval(timer);
   document.removeEventListener('visibilitychange',visibility);};
 },[identity,joined,sharedPage?.page]);
 const updateSharedInk=useCallback(async(onPage:number,next:QuranInkStroke[])=>{
  if(identity?.role!=='teacher'||!joined||!sharedPage||sharedPage.page!==onPage||
    !ink||ink.page!==onPage||inkBusy||inkMode==='off')return;
  const current=new Set(ink.strokes.map(s=>s.id));
  const desired=new Set(next.map(s=>s.id));
  const added=next.filter(s=>!current.has(s.id));
  const removed=ink.strokes.filter(s=>!desired.has(s.id));
  if(added.length+removed.length!==1)return;
  const operation=added.length===1?
   {action:'add' as const,page:onPage,expectedRevision:ink.revision,
    requestId:crypto.randomUUID(),stroke:compactStroke(added[0]!)}:
   {action:'hide' as const,page:onPage,expectedRevision:ink.revision,
    requestId:crypto.randomUUID(),strokeId:removed[0]!.id};
  setInkBusy(true);setInkError('');
  try{
   const result=await fetchLiveInk(identity,onPage,operation);
   if(!alive.current)return;
   setInk(previous=>previous&&previous.page===result.ink.page&&
    previous.revision>result.ink.revision?previous:result.ink);
   if(result.code==='INK_CONFLICT')setInkError('تغيّرت العلامات أثناء الرسم؛ استعدنا الإصدار المحفوظ.');
   if(result.code==='INK_LIMIT')setInkError('بلغت الصفحة الحد الآمن للعلامات.');
  }catch{if(alive.current)setInkError('تعذّر حفظ الرسم. لم تتم إضافة علامة غير مؤكدة.');}
  finally{if(alive.current)setInkBusy(false);}
 },[identity,joined,sharedPage,ink,inkBusy,inkMode]);
 const changeSharedPage=useCallback(async(next:number,verse?:VerseSelection):Promise<boolean>=>{
  if(identity?.role!=='teacher'||!joined||!sharedPage||pageBusy)return false;
  const page=clampQuranPage(next);
  if(page===sharedPage.page&&(!verse||
   (sharedPage.verse?.surah===verse.surah&&sharedPage.verse.ayah===verse.ayah)))return true;
  setPageBusy(true);setPageError('');
  try{
   const result=await callPage(identity,{page,expectedRevision:sharedPage.revision,
    requestId:crypto.randomUUID(),...(verse?{verse}:{})});
   if(!alive.current)return false;
   setSharedPage(prev=>prev&&prev.revision>result.quran.revision?prev:result.quran);
   if(result.code==='QURAN_PAGE_CONFLICT'){
    setPageError('تغيّرت الصفحة أو الآية على السيرفر؛ تم استعادة أحدث إصدار.');
    return false;
   }
   setInkMode('off');
   return true;
  }catch{
   if(alive.current)setPageError('تعذّر تأكيد الصفحة أو الآية المشتركة؛ لم يُعرض تحديد غير محفوظ.');
   return false;
  }finally{if(alive.current)setPageBusy(false);}
 },[identity,joined,sharedPage,pageBusy]);
 if(identity===undefined)return <main dir="rtl" className={liveCss.boot}>
  <p role="status">جارٍ التحقق من غرفة الحصة…</p>
 </main>;
 if(identity===null||status==='denied')return <main dir="rtl" className={liveCss.boot}>
  <h1>رابط الحصة غير صالح</h1>
  <p>افتح الحصة المصرح بها من جدول الشيخ أو الطالب؛ لا يمنح الرابط أي صلاحيات.</p>
  <Link href="/student">العودة للبوابة</Link>
 </main>;
 const role=identity.role==='learner'?'student':'teacher';
 const page=sharedPage?.page??1;
 const teacherCanTurn=identity.role==='teacher'&&joined&&!!sharedPage&&!pageBusy;
 const teacherCanDraw=teacherCanTurn&&!!ink&&ink.page===page&&!inkBusy;
 const currentStrokes=ink?.page===page?ink.strokes:[];
 const selectedVerse:QuranTarget|null=sharedPage?.verse?
  {page,surah:sharedPage.verse.surah,ayah:sharedPage.verse.ayah,wordIndex:null}:null;
 return <div ref={stageRef}
  className={[css.root,liveCss.connected,focusMode?css.focusMode:'',
   panelOpen?css.panelExpanded:''].filter(Boolean).join(' ')}
  data-view-role={role} data-focus={focusMode?'on':'off'} data-classroom-connected="true"
  dir="rtl" aria-label="الفصل القرآني المتصل">
  <header className={barCss.header} aria-label="إدارة الحصة المتصلة">
   <div className={barCss.identity}>
    <Link className={barCss.back} href={role==='teacher'?'/teacher/schedule':'/student/lessons'}
     aria-label="العودة إلى جدول الحصص">‹</Link>
    <h1>الفصل التفاعلي</h1>
    <span className={barCss.previewLabel}>LiveKit · موثق</span>
   </div>
   <div className={barCss.sessionInfo}>
    <span className={barCss.phase}
     data-phase={lessonPhase==='completed'?'ended':lessonPhase==='live'?'live':'waiting'}>
     {lessonPhase==='completed'?'انتهت الحصة':lessonPhase==='live'?'الحصة جارية':
      joined?'غرفة الانتظار':'غير منضم'}
    </span>
    <span className={liveCss.sessionRole}>{role==='teacher'?'الشيخ':'الطالب'}</span>
   </div>
   <div className={barCss.actions}>
    <LiveLessonLifecycle role={identity.role} lessonId={identity.lessonId}
      learnerId={identity.learnerId} joined={joined}
      bothPresent={presence?.bothPresent===true}
      onPhase={phase=>{setLessonPhase(phase);
       if(phase==='completed'||phase==='cancelled')setJoined(false);}}/>
    <button type="button" className={barCss.start}
     disabled={busy||status!=='ready'||lessonPhase==='completed'||lessonPhase==='cancelled'}
     onClick={()=>void refresh(joined?'leave':'join')}>
     {busy?'جارٍ التأكيد…':joined?'مغادرة الحصة':'الانضمام لغرفة الانتظار'}
    </button>
    {role==='teacher'&&<button type="button" className={barCss.iconAction}
     aria-label="الأخطاء والتقييم" aria-expanded={panelOpen} aria-controls="lesson-notes"
     onClick={()=>setPanelOpen(v=>!v)}>✎</button>}
    <button type="button" className={barCss.iconAction}
     aria-label={focusMode?'الخروج من وضع الحصة':'وضع الحصة'}
     aria-pressed={focusMode} onClick={()=>void toggleFocus()}>⛶</button>
    <details className={barCss.menu} onKeyDown={event=>{
     if(event.key==='Escape'){
      event.preventDefault();event.currentTarget.open=false;
      event.currentTarget.querySelector('summary')?.focus();
     }
    }}>
     <summary aria-label="حالة المشاركين وإعدادات الغرفة">⚙</summary>
     <div className={barCss.menuPanel}>
      <strong>غرفة الحصة · اتصال موثّق</strong>
      <div className={barCss.presence} aria-label="حالة طرفي الحصة">
       <span className={liveCss.actor} data-online={presence?.teacherPresent?'true':'false'}>
        ● الشيخ {presence?.teacherPresent?'متصل':'غير متصل'}
       </span>
       <span className={liveCss.actor} data-online={presence?.learnerPresent?'true':'false'}>
        ● الطالب {presence?.learnerPresent?'متصل':'غير متصل'}
       </span>
      </div>
      <p role="status" className={liveCss.menuStatus}>
       {status==='loading'?'جارٍ التحقق من الغرفة…':joined?
        (presence?.bothPresent?'الطرفان في غرفة الانتظار':'بانتظار الطرف الآخر'):
        'انضم أولًا لطلب تصريح الصوت والفيديو.'}
      </p>
      <button type="button" disabled={busy} onClick={()=>void refresh('snapshot')}>
       تحديث حالة الطرفين
      </button>
      <small>الشيخ وحده يبدأ الحصة رسميًا وينهيها. الكاميرا والمايك لا يعملان تلقائيًا؛ التوقيت موثق على D1.</small>
     </div>
    </details>
   </div>
  </header>
  {error&&<p className={liveCss.error} role="alert">{error}</p>}
  {pageError&&<p className={liveCss.error} role="alert">{pageError}</p>}
  {inkError&&<p className={liveCss.error} role="alert">{inkError}</p>}
  <div className={css.workspace}>
   <aside className={[css.mediaPanel,liveCss.mediaPanel].join(' ')} aria-label="لوحة فيديو المشاركين">
    <header className={css.mediaHead}><strong>المشاركون</strong>
     <span>{joined?'غرفة صوت وفيديو حقيقية':'الكاميرا مغلقة'}</span>
    </header>
    {joined&&status==='ready'&&lessonPhase!=='completed'?<LiveLessonMedia identity={identity} active={joined} embedded/>:
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
     <span className={css.quranStatus}>{sharedPage?'يتبع الطالب الشيخ · إصدار '+sharedPage.revision:'بانتظار تأكيد الصفحة من السيرفر'}</span>
    </header>
    <div className={css.toolbar} role="toolbar" aria-label="أدوات المصحف">
     <div className={css.inkPalette} aria-label="القلم والألوان">
      <div className={css.toolGroup}>
       {([{id:'off',symbol:'⌖',name:'تحديد الآية'},{id:'pen',symbol:'✎',name:'قلم'},
        {id:'marker',symbol:'▰',name:'تظليل'},{id:'eraser',symbol:'⌫',name:'ممحاة'}] as const).map(item=>
        <button key={item.id} type="button"
         title={item.id==='off'?'تحديد آية للقراءة فقط':
          teacherCanDraw?item.name:item.name+' متاح للشيخ بعد الانضمام وتأكيد الصفحة'}
         aria-label={item.name} aria-pressed={inkMode===item.id}
         disabled={item.id!=='off'&&!teacherCanDraw}
         onClick={()=>setInkMode(item.id)}>
         <span aria-hidden="true">{item.symbol}</span>
         <span className={css.toolLabel}>{item.name}</span>
        </button>)}
      </div>
      <div className={css.colors} role="group" aria-label="ألوان الرسم">
       {([{color:'#d0a94c',name:'ذهبي'},{color:'#388e68',name:'أخضر'},
        {color:'#e2604e',name:'أحمر'},{color:'#397ca7',name:'أزرق'},
        {color:'#8d67b0',name:'بنفسجي'}] as const).map(({color,name})=>
        <button key={color} type="button" className={css.color} style={{background:color}}
         disabled={!teacherCanDraw} aria-pressed={inkColor===color}
         onClick={()=>setInkColor(color)} title={'لون '+name}
         aria-label={'اختر لون '+name}/>)}
      </div>
     </div>
     <div className={[css.toolGroup,css.pageNavigation].join(' ')}
      role="group" aria-label="التنقل في الصفحة المشتركة بإذن الشيخ">
      <button type="button" aria-label="الصفحة السابقة" title="الصفحة السابقة"
       disabled={!teacherCanTurn||page<=1} onClick={()=>void changeSharedPage(page-1)}>
       <span aria-hidden="true">‹</span>
      </button>
      <span aria-live="polite">{page} / 604</span>
      <button type="button" aria-label="الصفحة التالية" title="الصفحة التالية"
       disabled={!teacherCanTurn||page>=604} onClick={()=>void changeSharedPage(page+1)}>
       <span aria-hidden="true">›</span>
      </button>
     </div>
    </div>
    <div className={css.quranViewport} data-quran-layout="viewport-fit">
     {role==='teacher'&&<QuranVersePicker enabled={teacherCanTurn}
       selected={sharedPage?.verse??null} onNavigate={changeSharedPage}/>}
     <button type="button" className={css.pageEdgePrev} title="الصفحة السابقة" aria-label="الصفحة السابقة"
      disabled={!teacherCanTurn||page<=1} onClick={()=>void changeSharedPage(page-1)}>‹</button>
     <ReaderPrintedPage page={page} viewportFit inkMode={teacherCanDraw?inkMode:'off'} color={inkColor}
      strokes={currentStrokes} selectedKey={selectedVerse?targetKey(selectedVerse):null}
      noteKeys={new Set<string>()}
      onSelect={target=>{if(teacherCanTurn)void changeSharedPage(page,
        {surah:target.surah,ayah:target.ayah});}}
      onOpenNote={target=>{if(teacherCanTurn)void changeSharedPage(page,
        {surah:target.surah,ayah:target.ayah});}}
      onInkChange={(targetPage,next)=>void updateSharedInk(targetPage,next)}/>
     <button type="button" className={css.pageEdgeNext} title="الصفحة التالية" aria-label="الصفحة التالية"
      disabled={!teacherCanTurn||page>=604} onClick={()=>void changeSharedPage(page+1)}>›</button>
    </div>
    <footer className={css.quranFooter}>
     <span>الصفحة {page} من ٦٠٤ · الصفحة وتحديد الآية مشتركان ومعتمدان من السيرفر</span>
     {selectedVerse&&<span>الآية المختارة عند الطرفين: {selectedVerse.surah}:{selectedVerse.ayah}</span>}
    </footer>
   </main>
   <div className={css.panelSlot} id="lesson-notes" data-open={panelOpen?'true':'false'}>
    <ConnectedClassroomNotes role={role} page={page} lessonId={identity.lessonId}
     joined={joined&&lessonPhase!=='completed'} selectedVerse={selectedVerse}/>
   </div>
  </div>
  <p className={[css.disclaimer,liveCss.disclaimer].join(' ')}>
   الصفحات والرسم موثّقان على Cloudflare؛ رسم الطالب والتصحيحات والتقارير لم تُفعّل بعد. الصوت والفيديو عبر LiveKit بموافقتك.
  </p>
 </div>;
}
