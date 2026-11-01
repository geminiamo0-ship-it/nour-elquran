'use client';
import {useEffect,useState} from 'react';
import {lessonReportsClient,reportErrorMessage,type StudentReport} from '../../shared';
import css from './LessonsPremium.module.css';
const score=(v:number|null)=>v===null?'لم يُقيّم':v+' / 10';
const when=(ms:number)=>new Intl.DateTimeFormat('ar-EG',{
 timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'
}).format(new Date(ms));
export function ConnectedProgressReports({learnerId}:{learnerId:string}){
 const [rows,setRows]=useState<readonly StudentReport[]>([]);
 const [status,setStatus]=useState<'loading'|'loaded'|'error'>('loading');
 const [retry,setRetry]=useState(0);
 const [expanded,setExpanded]=useState<string|null>(null);
 const [count,setCount]=useState(8);
 useEffect(()=>{
  const abort=new AbortController();
  setStatus('loading');setRows([]);setExpanded(null);setCount(8);
  void lessonReportsClient.student(learnerId,abort.signal).then(data=>{
   if(!abort.signal.aborted){
    setRows(data.filter(report=>report.learnerId===learnerId)
     .slice().sort((a,b)=>b.publishedAtMs-a.publishedAtMs));
    setStatus('loaded');
   }
  }).catch(()=>{if(!abort.signal.aborted)setStatus('error');});
  return()=>abort.abort();
 },[learnerId,retry]);
 return <section className={css.panel} aria-label="التقارير المعتمدة">
  <div className={css.panelHead}><h2>تقارير الشيخ</h2>
   {status==='loaded'&&rows.length>0&&<small>{rows.length} تقرير معتمد</small>}
  </div>
  {status==='loading'?<p role="status">جارٍ تحميل التقارير…</p>:
   status==='error'?<div role="alert"><p>{reportErrorMessage(null)}</p>
    <button type="button" className={css.detailsButton} onClick={()=>setRetry(x=>x+1)}>إعادة المحاولة</button>
   </div>:rows.length===0?<p className={css.reportEmpty}>لم ينشر الشيخ تقريرًا معتمدًا بعد.</p>:
   <div className={css.reportList}>
    {rows.slice(0,count).map(report=><article className={css.reportCard} key={report.lessonId}>
     <div className={css.reportHead}><div>
      <strong>{when(report.publishedAtMs)}</strong>
      <small>تقرير الحصة · الإصدار {report.revision}</small>
     </div>
      <button type="button" className={css.detailsButton}
       aria-expanded={expanded===report.lessonId}
       onClick={()=>setExpanded(expanded===report.lessonId?null:report.lessonId)}>
       {expanded===report.lessonId?'إخفاء التفاصيل':'التفاصيل'}
      </button></div>
     <div className={css.reportGrades}>
      <div className={css.grade}><span>الحفظ</span><strong>{score(report.memorization)}</strong></div>
      <div className={css.grade}><span>التلاوة</span><strong>{score(report.recitation)}</strong></div>
      <div className={css.grade}><span>التجويد</span><strong>{score(report.tajweed)}</strong></div>
     </div>
     {expanded===report.lessonId&&<div className={css.detailText}>
      <p><b>الآيات المنجزة:</b> {report.scope}</p>
      {report.strengths&&<p><b>نقاط القوة:</b> {report.strengths}</p>}
      {report.corrections&&<p><b>تصحيحات الشيخ:</b> {report.corrections}</p>}
      {report.nextPlan&&<p><b>الخطة القادمة:</b> {report.nextPlan}</p>}
     </div>}
    </article>)}
    {count<rows.length&&<button type="button" className={css.more}
     onClick={()=>setCount(n=>Math.min(n+8,rows.length))}>عرض المزيد</button>}
   </div>}
 </section>;
}
