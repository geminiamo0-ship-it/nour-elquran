'use client';
import {useEffect,useState} from 'react';
import {assignmentClient,assignmentMessage,type PublishedAssignment} from '../../shared';
import {TrainingQuranSession} from './TrainingQuranSession';
import {StudentAssignmentSubmission} from './StudentAssignmentSubmission';
import css from './TrainingWorkspace.module.css';

const client=assignmentClient();
const kinds={memorization:'حفظ',revision:'مراجعة',recitation:'تلاوة'};
type Read={status:'loading'}|{status:'error';message:string}|
 {status:'loaded';tasks:readonly PublishedAssignment[]};

function SubmissionDetails({learnerId,assignmentId}:{learnerId:string;assignmentId:string}){
 // Mount on first open and retain the draft and pending network operation on collapse.
 const [visited,setVisited]=useState(false);
 return <details className={css.submissionDetails}
  onToggle={e=>{if(e.currentTarget.open)setVisited(true);}}>
  <summary>تسليم الواجب والتصحيحات</summary>
  {visited&&<StudentAssignmentSubmission learnerId={learnerId} assignmentId={assignmentId}/>}
 </details>;
}

export function StudentPublishedAssignments({learnerId,onPractice}:{learnerId:string;onPractice?:()=>void}){
 const [data,setData]=useState<Read>({status:'loading'}),[retry,setRetry]=useState(0);
 const [opened,setOpened]=useState<string|null>(null);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  setData({status:'loading'});setOpened(null);
  void client.owner(learnerId,controller.signal).then(tasks=>{
   if(active&&!controller.signal.aborted)
    setData({status:'loaded',tasks:tasks.filter(t=>t.learnerId===learnerId)});
  }).catch(error=>{
   if(active&&!controller.signal.aborted)setData({status:'error',message:assignmentMessage(error)});
  });
  return()=>{active=false;controller.abort();};
 },[learnerId,retry]);
 useEffect(()=>{
  if(data.status!=='loaded')return;
  const id=window.location.hash.match(/^#assignment-([0-9a-f-]{36})$/i)?.[1];
  if(!id||!data.tasks.some(task=>task.id===id))return;
  setOpened(id);
  const frame=requestAnimationFrame(()=>
   document.getElementById('assignment-'+id)?.scrollIntoView({block:'start',behavior:'smooth'}));
  return()=>cancelAnimationFrame(frame);
 },[data]);
 return <div className={css.content} aria-label="واجباتي المنشورة">
  <div className={css.sectionHeading}><h2>واجباتي من الشيخ</h2>
   {data.status==='loaded'&&data.tasks.length>0&&
    <span className={css.count}>{data.tasks.length} واجب</span>}
  </div>
  {data.status==='loading'?<p role="status" className={css.loading}>جارٍ تحميل واجباتك…</p>:
   data.status==='error'?<div className={css.emptyBox} role="alert">
    <strong>{data.message}</strong>
    <button type="button" className={css.outlineButton} onClick={()=>setRetry(v=>v+1)}>
     إعادة المحاولة</button>
   </div>:
   data.tasks.length===0?<div className={css.emptyBox}>
    <strong>لا توجد واجبات منشورة الآن.</strong>
    {onPractice&&<button type="button" className={css.primaryButton}
     onClick={onPractice}>ابدأ تدريبًا حرًا</button>}
   </div>:
   <div className={css.cards}>{data.tasks.map(task=>{
    const open=task.id===opened;
    return <article key={task.id} id={'assignment-'+task.id}
     className={open?css.cardExpanded:css.card}>
     <div className={css.rowBetween}>
      <span className={css.tag}>{kinds[task.kind]}</span>
      <span className={css.statusPending}>من الشيخ</span>
     </div>
     <div className={css.taskMain}><div>
      <h3>سورة {task.surah} · الآيات {task.fromAyah}–{task.toAyah}</h3>
      <p>الموعد: {new Date(task.dueAtMs).toLocaleDateString('ar-EG')}</p>
     </div><button type="button" className={css.primaryButton}
      aria-expanded={open} onClick={()=>setOpened(open?null:task.id)}>
      {open?'إغلاق المصحف':'ابدأ في المصحف'}
     </button></div>
     {task.instructions&&<details className={css.submissionDetails}>
      <summary>تعليمات الشيخ</summary><p>{task.instructions}</p>
     </details>}
     {open&&<TrainingQuranSession key={task.id}
      title={'واجب سورة '+task.surah}
      range={{surah:task.surah,fromAyah:task.fromAyah,toAyah:task.toAyah,page:task.startPage}}
      endPage={task.endPage} onClose={()=>setOpened(null)}/>}
     <SubmissionDetails key={task.id} learnerId={learnerId} assignmentId={task.id}/>
    </article>;
   })}</div>}
 </div>;
}
