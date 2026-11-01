'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {notebookClient,type LessonRow} from '../../shared';
import {StudentAcademicPlanCard} from './StudentAcademicPlanCard';
import {nextVerifiedPreparationLesson} from '../connected-training-preparation';
import css from './TrainingWorkspace.module.css';

type Reading={status:'loading'}|{status:'error'}|{status:'ready';lessons:readonly LessonRow[]};
const format=new Intl.DateTimeFormat('ar-EG',{
 timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'
});

export function StudentConnectedPreparation({learnerId,onHomework,onPractice}:{
 learnerId:string;onHomework:()=>void;onPractice:()=>void
}){
 const [reading,setReading]=useState<Reading>({status:'loading'});
 const [reload,setReload]=useState(0);
 const [planViewed,setPlanViewed]=useState(false);
 useEffect(()=>{
  const abort=new AbortController();
  setReading({status:'loading'});
  void notebookClient.lessons(learnerId,abort.signal).then(rows=>{
   if(abort.signal.aborted)return;
   // Verify the learner scope before displaying any live lesson.
   nextVerifiedPreparationLesson(rows,learnerId,Date.now());
   setReading({status:'ready',lessons:rows});
  }).catch(()=>{if(!abort.signal.aborted)setReading({status:'error'});});
  return()=>abort.abort();
 },[learnerId,reload]);
 const next=reading.status==='ready'?
  nextVerifiedPreparationLesson(reading.lessons,learnerId,Date.now()):null;
 return <section className={css.content} id="training-panel-prepare"
  role="tabpanel" aria-labelledby="training-tab-prepare">
  <div className={css.sectionHeading}><h2>استعداد للحصة</h2>
   <Link className={css.outlineButton} href="/student/lessons">جدول حصصي</Link></div>
  {reading.status==='loading'?<p role="status" className={css.loading}>
   جارٍ تحميل موعد الحصة من حساب الطالب الموثق…</p>:
   reading.status==='error'?<div className={css.emptyBox} role="alert">
    <strong>تعذر التحقق من موعد الحصة.</strong>
    <button type="button" className={css.outlineButton}
     onClick={()=>setReload(n=>n+1)}>إعادة المحاولة</button>
   </div>:
   next?<div className={css.prepareCard}>
    <div className={css.rowBetween}>
     <strong>{next.status==='live'?'حصتك جارية الآن':'حصتك القادمة'}</strong>
     <span className={css.tag}>{next.kind==='trial'?'تجريبية':
      next.kind==='makeup'?'تعويضية':'حفظ ومراجعة'}</span>
    </div>
    <p>{format.format(new Date(next.startsAtMs))}</p>
    <div className={css.prepRows}>
     <div><span>١</span><strong>راجع واجبات الشيخ</strong>
      <button type="button" className={css.textAction} onClick={onHomework}>واجباتي</button></div>
     <div><span>٢</span><strong>تدرب على التسميع</strong>
      <button type="button" className={css.textAction} onClick={onPractice}>ابدأ</button></div>
     <div><span>٣</span><strong>راجع تصحيحاتك</strong>
      <Link className={css.textAction} href="/student/lessons#notebook">سجل الحصص</Link></div>
    </div>
    <Link className={css.primaryButton}
     href={'/classroom/live?role=learner&lessonId='+encodeURIComponent(next.id)+
      '&learnerId='+encodeURIComponent(learnerId)}>
     فتح غرفة الانتظار</Link>
   </div>:<div className={css.emptyBox}>
    <strong>لا توجد حصة قادمة مؤكدة.</strong>
    <button type="button" className={css.primaryButton} onClick={onPractice}>
     ابدأ الحفظ والمراجعة</button>
   </div>}
  <details className={css.submissionDetails}
   onToggle={e=>{if(e.currentTarget.open)setPlanViewed(true);}}>
   <summary>خطة الشيخ للحفظ والمراجعة</summary>
   {planViewed&&<StudentAcademicPlanCard key={learnerId} learnerId={learnerId}/>}
  </details>
 </section>;
}
