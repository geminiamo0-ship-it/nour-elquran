'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {assignmentClient,assignmentMessage,type PublishedAssignment} from '../../shared';
import {TrainingQuranSession} from './TrainingQuranSession';
import css from './TrainingWorkspace.module.css';
const client=assignmentClient();
const kinds={memorization:'حفظ',revision:'مراجعة',recitation:'تلاوة'};
type Read={status:'loading'}|{status:'error';message:string}|{status:'loaded';tasks:readonly PublishedAssignment[]};
export function StudentPublishedAssignments({learnerId}:{learnerId:string}){
 const [data,setData]=useState<Read>({status:'loading'}),[retry,setRetry]=useState(0);
 const [opened,setOpened]=useState<string|null>(null);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  setData({status:'loading'});setOpened(null);
  void client.owner(learnerId,controller.signal).then(tasks=>{
   if(active&&!controller.signal.aborted)setData({status:'loaded',tasks});
  }).catch(error=>{
   if(active&&!controller.signal.aborted)setData({status:'error',message:assignmentMessage(error)});
  });
  return()=>{active=false;controller.abort();};
 },[learnerId,retry]);
 return <div className={css.content} aria-label="واجباتي المنشورة">
  <div className={css.sectionHeading}>
    <div><p className={css.overline}>الواجبات المنشورة من الشيخ</p><h3>واجباتي الفعلية</h3></div>
    <button type="button" className={css.outlineButton} onClick={()=>setRetry(v=>v+1)}>تحديث</button>
  </div>
  {data.status==='loading'?<p role="status">جارٍ قراءة الواجبات من الخادم...</p>:
   data.status==='error'?<p role="alert">{data.message}</p>:
   !data.tasks.length?<div className={css.emptyBox}>
    <strong>لا توجد واجبات منشورة من الشيخ لهذا الطالب بعد.</strong>
    <p>التدريب الذاتي متاح، لكنه ليس واجبًا معتمدًا.</p>
   </div>:<div className={css.cards}>{data.tasks.map(task=>{
     const open=task.id===opened,onePage=task.startPage===task.endPage;
     return <article key={task.id} className={open?css.cardExpanded:css.card}>
      <div className={css.rowBetween}><span className={css.tag}>{kinds[task.kind]}</span>
       <span className={css.statusPending}>تكليف منشور</span></div>
      <h4>سورة {task.surah} · الآيات {task.fromAyah}–{task.toAyah}</h4>
      <p>{task.instructions}</p>
      <small>آخر موعد {new Date(task.dueAtMs).toLocaleString('ar-EG')} · صفحة {task.startPage}{onePage?'':' إلى '+task.endPage}</small>
      <div className={css.actions}>
       {onePage?<button type="button" className={css.primaryButton} aria-expanded={open}
        onClick={()=>setOpened(open?null:task.id)}>{open?'إغلاق التدريب':'ابدأ الواجب على المصحف'}</button>:
        <Link href="/student/mushaf" className={css.primaryButton}>افتح المصحف الكامل للمراجعة</Link>}
      </div>
      {open&&onePage&&<TrainingQuranSession key={task.id}
        title={'واجب سورة '+task.surah}
        range={{surah:task.surah,fromAyah:task.fromAyah,toAyah:task.toAyah,page:task.startPage}}
        onClose={()=>setOpened(null)}/>}
      <p className={css.subtle}>التدريب هنا لا يعني التسليم. رفع التسميع الصوتي للشيخ سيُفعّل بعد ربط التخزين الخاص.</p>
     </article>;
    })}</div>}
 </div>;
}
