'use client';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';
import css from './ClassroomSessionHeader.module.css';
import live from './ConnectedClassroom.module.css';
import {elapsedLessonLabel} from './lesson-elapsed';
type Phase='scheduled'|'live'|'completed'|'cancelled';
type Result=Readonly<{phase:Phase;lessonId:string;startedAtMs:number|null;
 endedAtMs:number|null;reservedUntilMs:number;instructionMinutes:30;reservationMinutes:40}>;
type Props=Readonly<{
 role:'teacher'|'learner';lessonId:string;learnerId?:string;
 joined:boolean;bothPresent:boolean;onPhase:(phase:Phase)=>void;
 refreshVersion?:number;
}>;
function endpoint(p:Props){
 const id=encodeURIComponent(p.lessonId);
 return p.role==='teacher'?'/v1/teacher/lessons/'+id:
  '/v1/me/learners/'+encodeURIComponent(p.learnerId!)+'/lessons/'+id;
}
function parse(raw:unknown):Result{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('INVALID_LIFECYCLE');
 const v=raw as Record<string,unknown>,data=v.lifecycle;
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('INVALID_LIFECYCLE');
 const l=data as Record<string,unknown>;
 if(!['scheduled','live','completed','cancelled'].includes(String(l.phase))||
  l.lessonId!==v.lessonId&&v.lessonId!==undefined||
  !Number.isSafeInteger(l.reservedUntilMs)||
  (l.startedAtMs!==null&&!Number.isSafeInteger(l.startedAtMs))||
  (l.endedAtMs!==null&&!Number.isSafeInteger(l.endedAtMs))||
  l.instructionMinutes!==30||l.reservationMinutes!==40)throw Error('INVALID_LIFECYCLE');
 return l as Result;
}
function message(code:string){
 const m:Record<string,string>={
  WAITING_FOR_PARTICIPANTS:'لازم الشيخ والطالب يكونا موجودين في غرفة الانتظار.',
  LESSON_NOT_STARTED_YET:'لا يمكن بدء الحصة قبل موعدها المجدول.',
  LESSON_NOT_STARTED:'لم تبدأ الحصة رسميًا بعد.',
  LESSON_CANCELLED:'الحصة أُلغيت.',
  LESSON_STATE_CONFLICT:'تغيرت حالة الحصة؛ تم تحديثها من السيرفر.',
  LIFECYCLE_UNAVAILABLE:'تعذّر الاتصال بخادم الحصص؛ حاول مجددًا.',
 };
 return m[code]??'تعذّر تأكيد العملية من الخادم؛ لم نعتمد أي تغيير محلي.';
}
export function LiveLessonLifecycle(props:Props){
 const {role,lessonId,joined,bothPresent,onPhase}=props;
 const [result,setResult]=useState<Result|null>(null);
 const [busy,setBusy]=useState(false);
 const [confirm,setConfirm]=useState(false);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [now,setNow]=useState(()=>Date.now());
 const inflight=useRef(false);
 const last=useRef<Phase|null>(null);
 const onPhaseRef=useRef(onPhase);
 useEffect(()=>{onPhaseRef.current=onPhase;},[onPhase]);
 const base=endpoint(props);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  const poll=async()=>{
   if(inflight.current||controller.signal.aborted||document.visibilityState==='hidden')return;
   inflight.current=true;
   try{
    const response=await fetch(base+'/lifecycle',{method:'GET',
     credentials:'same-origin',cache:'no-store',signal:controller.signal});
    const raw:unknown=await response.json();
    if(!response.ok)throw Error('LIFECYCLE_UNAVAILABLE');
    const data=parse(raw);
    if(!active)return;
    setResult(data);setError('');
    if(last.current!==data.phase){last.current=data.phase;onPhaseRef.current(data.phase);}
   }catch{if(active)setError('تعذّر تحديث حالة الحصة.');}
   finally{inflight.current=false;if(active)setLoading(false);}
  };
  void poll();
  const interval=window.setInterval(()=>void poll(),3500);
  const visible=()=>{if(document.visibilityState==='visible')void poll();};
  document.addEventListener('visibilitychange',visible);
  return()=>{active=false;controller.abort();window.clearInterval(interval);
   document.removeEventListener('visibilitychange',visible);};
 },[base,props.refreshVersion]);
 useEffect(()=>{
  if(result?.phase!=='live')return;
  const tick=()=>setNow(Date.now());
  tick();
  const interval=window.setInterval(tick,1000);
  document.addEventListener('visibilitychange',tick);
  return()=>{window.clearInterval(interval);
   document.removeEventListener('visibilitychange',tick);};
 },[result?.phase,result?.startedAtMs]);
 const submit=useCallback(async(action:'start'|'end')=>{
  if(role!=='teacher'||busy||!result||(!joined&&action==='start'))return;
  if(inflight.current)return;
  setBusy(true);setError('');inflight.current=true;
  try{
   const response=await fetch(base+'/lifecycle-actions',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({action,operationId:crypto.randomUUID()}),
    credentials:'same-origin',cache:'no-store',redirect:'error'
   });
   const raw:unknown=await response.json();
   const value=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:null;
   if(!response.ok||!value||!value.lifecycle)throw Error(String(value?.code??'LIFECYCLE_UNAVAILABLE'));
   const data=parse(raw);setResult(data);last.current=data.phase;onPhaseRef.current(data.phase);
   setConfirm(false);
  }catch(e){setError(message(e instanceof Error?e.message:'UNKNOWN'));}
  finally{inflight.current=false;setBusy(false);}
 },[role,busy,result,joined,base]);
 const phase=result?.phase;
 const elapsed=phase==='live'?elapsedLessonLabel(result?.startedAtMs??null,now):null;
 return <div className={live.lifecycleControls} aria-label="حالة وبدء وإنهاء الحصة">
  {loading?<span role="status">جارٍ التحقق…</span>:
   phase==='completed'?<span className={live.lifecycleDone}>انتهت الحصة</span>:
   phase==='live'?<><span className={live.lifecycleRunning}>الحصة جارية</span>
    <span className={css.clock} role="timer" aria-label="الوقت المنقضي منذ بداية الحصة">
     {elapsed??'جارٍ تأكيد البداية'}</span></>:
   <span className={live.lifecycleWaiting}>غرفة الانتظار</span>}
  {role==='teacher'&&phase==='scheduled'&&<button className={css.start}
   type="button" disabled={!joined||!bothPresent||busy||loading}
   onClick={()=>void submit('start')}>بدء الحصة</button>}
  {role==='teacher'&&phase==='live'&&<button className={css.end}
   type="button" disabled={busy} onClick={()=>setConfirm(true)}>إنهاء الحصة</button>}
  {role==='teacher'&&phase==='completed'&&<Link
   className={live.reportLink} href={'/teacher/reports?lessonId='+encodeURIComponent(lessonId)}>
   إعداد تقرير الحصة</Link>}
  {role==='learner'&&phase==='completed'&&<Link className={live.reportLink}
    href="/student/lesson-notebook">دفتر الحصص</Link>}
  {confirm&&phase==='live'&&<div className={css.confirm} role="group"
   aria-label="تأكيد إنهاء الحصة">
   <strong>إنهاء الحصة يحفظ وقت النهاية ويوقف الاتصال. هل تؤكد؟</strong>
   <button type="button" disabled={busy} onClick={()=>void submit('end')}>تأكيد الإنهاء</button>
   <button type="button" onClick={()=>setConfirm(false)}>رجوع</button>
  </div>}
  {error&&<span className={live.lifecycleError} role="alert">{error}</span>}
 </div>;
}
