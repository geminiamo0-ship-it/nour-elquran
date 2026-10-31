'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {notebookClient,type LessonRow} from '../../shared';
import {StudentAcademicPlanCard} from './StudentAcademicPlanCard';
import {nextVerifiedPreparationLesson} from '../connected-training-preparation';
import css from './TrainingWorkspace.module.css';

type Reading={status:'loading'}|{status:'error'}|{status:'ready';lessons:readonly LessonRow[]};
const format=new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',
 dateStyle:'full',timeStyle:'short'});

/** Live learner preparation. No demo schedule, teacher name or assignment is fabricated.
 * Existing signed academic plan and published tasks are shown separately.
 */
export function StudentConnectedPreparation({learnerId,onHomework,onPractice}:{
 learnerId:string;onHomework:()=>void;onPractice:()=>void
}){
 const [reading,setReading]=useState<Reading>({status:'loading'});
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  const abort=new AbortController();
  setReading({status:'loading'});
  void notebookClient.lessons(learnerId,abort.signal).then(rows=>{
   if(abort.signal.aborted)return;
   // Even a malformed/mis-scoped 200 must never expose a sibling's schedule.
   nextVerifiedPreparationLesson(rows,learnerId,Date.now());
   setReading({status:'ready',lessons:rows});
  }).catch(()=>{if(!abort.signal.aborted)setReading({status:'error'});});
  return()=>abort.abort();
 },[learnerId,reload]);
 const next=reading.status==='ready'?
  nextVerifiedPreparationLesson(reading.lessons,learnerId,Date.now()):null;
 return <section className={css.content} id="training-panel-prepare"
  role="tabpanel" aria-labelledby="training-tab-prepare"
  aria-label="الاستعداد للحصة القادمة من الجدول الموثق">
  <div className={css.sectionHeading}>
   <div><p className={css.overline}>قبل اللقاء القادم · من جدول الخادم</p>
    <h3>الاستعداد للحصة</h3></div>
   <Link href="/student/lessons" className={css.outlineButton}>جدول حصصي</Link>
  </div>
  {reading.status==='loading'?<p role="status">جارٍ تحميل موعد الحصة من حساب الطالب الموثق…</p>:
   reading.status==='error'?<div role="alert" className={css.emptyBox}>
    <strong>تعذر التحقق من موعد الحصة من الخادم.</strong>
    <p>لن نستبدل الخطأ بجدول تجريبي أو ندّعي عدم وجود حصة.</p>
    <button type="button" className={css.outlineButton}
     onClick={()=>setReload(n=>n+1)}>إعادة المحاولة</button></div>:
   next?<div className={css.prepareCard}>
    <div className={css.rowBetween}>
     <strong>{next.status==='live'?'الحصة جارية':'الحصة القادمة مؤكدة'}</strong>
     <span className={css.tag}>{next.kind==='trial'?'تجريبية':
      next.kind==='makeup'?'تعويضية':'حصة أساسية'}</span>
    </div>
    <p>الموعد من الخادم: {format.format(new Date(next.startsAtMs))}</p>
    <div className={css.actions}>
     <Link className={css.primaryButton}
      href={'/classroom/live?role=learner&lessonId='+encodeURIComponent(next.id)+
       '&learnerId='+encodeURIComponent(learnerId)}>
      فتح غرفة الحصة المصرّح بها</Link>
    </div>
    <h4>خطوات التحضير المقترحة</h4>
    <div className={css.prepRows}>
     <div><span>١</span><p>راجع الواجبات المنشورة من الشيخ أولًا.</p>
      <button type="button" className={css.textAction} onClick={onHomework}>واجباتي</button></div>
     <div><span>٢</span><p>اختبر حفظك بنفس المصحف من غير إرسال تسميع تلقائي.</p>
      <button type="button" className={css.textAction} onClick={onPractice}>تدريب حر</button></div>
     <div><span>٣</span><p>راجع تصحيحات الشيخ في دفتر الحصص.</p>
      <Link className={css.textAction} href="/student/notebook">دفتر الحصص</Link></div>
    </div>
    <p className={css.subtle}>هذه خطوات مساعدة، وليست واجبات جديدة ولا إثبات حضور.</p>
   </div>:<div className={css.emptyBox}>
    <strong>لا توجد حصة قادمة مؤكدة في جدول هذا الطالب.</strong>
    <p>النتيجة من الخادم. يمكنك الاستمرار في الحفظ والمراجعة الذاتية بدون حجز وهمي.</p>
    <button type="button" className={css.primaryButton} onClick={onPractice}>
     الحفظ والمراجعة الحرة</button>
   </div>}
  <StudentAcademicPlanCard key={learnerId} learnerId={learnerId}/>
  <p className={css.subtle}>خطة الشيخ للورد والواجب المنشور مصدران مستقلان؛
   لا تُنشئ خطة الحفظ واجبًا جديدًا أو حجزًا تلقائيًا.</p>
 </section>;
}
