'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {assignmentClient,lessonReportsClient,notebookClient,
 type LessonRow,type PublishedAssignment,type StudentReport} from '../shared';
import {StudentAcademicPlanCard} from './components/StudentAcademicPlanCard';
import {StudentConnectedInbox} from './components/StudentConnectedInbox';
import styles from './StudentPortal.module.css';

type Read={status:'loading'}|{status:'error'}|
 {status:'ready';lessons:readonly LessonRow[];tasks:readonly PublishedAssignment[];
  reports:readonly StudentReport[]};
const tasksClient=assignmentClient();
const format=new Intl.DateTimeFormat('ar-EG',{
 timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'
});
const score=(n:number|null)=>n===null?'لم يُقيّم':n+' / 10';
function Metric({title,value,detail}:{title:string;value:string;detail:string}){
 return <article className={styles.metric}>
  <span>{title}</span><strong>{value}</strong><small>{detail}</small>
 </article>;
}
/** The authenticated student home never reads StudentContext's demo-only
 * snapshot. All numbers originate from server-confirmed owner-scoped APIs.
 */
export function ConnectedStudentDashboard({learnerId,name}:{
 learnerId:string;name:string;
}){
 const [data,setData]=useState<Read>({status:'loading'});
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setData({status:'loading'});
  void Promise.all([
   notebookClient.lessons(learnerId,controller.signal),
   tasksClient.owner(learnerId,controller.signal),
   lessonReportsClient.student(learnerId,controller.signal),
  ]).then(([lessons,tasks,reports])=>{
   if(!controller.signal.aborted)setData({status:'ready',lessons,tasks,reports});
  }).catch(()=>{
   if(!controller.signal.aborted)setData({status:'error'});
  });
  return()=>controller.abort();
 },[learnerId,reload]);
 const isReady=data.status==='ready';
 const upcoming=isReady?data.lessons.filter(l=>
  (l.status==='scheduled'||l.status==='live')&&l.endsAtMs>Date.now())
  .sort((a,b)=>a.startsAtMs-b.startsAtMs):[];
 const next=upcoming[0];
 const last=isReady?data.reports[0]:undefined;
 return <>
  <div className={styles.pageHeader}>
   <div><p className={styles.eyebrow}>لوحة الطالب · بيانات الحساب الفعلية</p>
    <h1>السلام عليكم، {name}</h1>
    <p>جدولك والورد المعتمد والتقارير المنشورة، بدون بيانات توضيحية.</p>
   </div>
   <span className={styles.headerDecoration} aria-hidden="true">بِسْمِ اللَّهِ</span>
  </div>
  {data.status==='loading'?<section className={styles.panel} role="status">
   جارٍ تحميل بيانات الطالب الموثقة من الخادم…</section>:
   data.status==='error'?<section className={styles.panel} role="alert">
    <h2>تعذّر التحقق من بيانات الطالب</h2>
    <p>لن نستبدل فشل الخادم بأرقام افتراضية أو سجل فارغ.</p>
    <button type="button" className={styles.outlineButton}
     onClick={()=>setReload(n=>n+1)}>إعادة المحاولة</button>
   </section>:<>
    <section className={styles.contextStrip} aria-label="الحصة القادمة">
     <div><span className={styles.smallOverline}>الخطوة التالية</span>
      <h2>{next?'استعد لحصتك القادمة':'لا توجد حصة مجدولة حاليًا'}</h2>
      <p>{next?'موعد حقيقي: '+format.format(new Date(next.startsAtMs)):
       'المواعيد لا تظهر إلا بعد اعتماد الحجز على الخادم.'}</p></div>
     <Link href="/student/lessons" className={styles.goldButton}>
      {next?'عرض الحصة وغرفة الانتظار':'عرض حصصي'}</Link>
    </section>
    <section className={styles.metricGrid} aria-label="ملخص البيانات الموثقة">
     <Metric title="الحصص القادمة" value={String(upcoming.length)} detail="حجوزات فعلية"/>
     <Metric title="الواجبات المنشورة" value={String(data.tasks.length)}
      detail="تكليفات معتمدة من الشيخ"/>
     <Metric title="الحصص المكتملة"
      value={String(data.lessons.filter(l=>l.status==='completed').length)}
      detail="حالة محفوظة في الخادم"/>
     <Metric title="التقارير المعتمدة" value={String(data.reports.length)}
      detail="آخر إصدار منشور لكل حصة"/>
    </section>
    <div className={styles.primaryGrid}>
     <section className={styles.panel}>
      <div className={styles.panelHead}><div>
       <span className={styles.eyebrow}>جدول الحصص</span>
       <h2>مواعيدي القادمة</h2></div>
       <Link className={styles.inlineLink} href="/student/lessons">كل الحصص ‹</Link>
      </div>
      {upcoming.length?<div className={styles.lessonList}>
       {upcoming.slice(0,3).map(lesson=><article className={styles.lessonRow}
        key={lesson.id}>
        <div className={styles.lessonInfo}>
         <strong>{format.format(new Date(lesson.startsAtMs))}</strong>
         <span>{lesson.kind==='trial'?'تجريبية':
          lesson.kind==='makeup'?'تعويضية':'أساسية'}</span>
        </div>
        <Link className={styles.outlineButton}
         href={'/classroom/live?role=learner&lessonId='+
          encodeURIComponent(lesson.id)+'&learnerId='+encodeURIComponent(learnerId)}>
         غرفة الحصة</Link>
       </article>)}</div>:<div className={styles.emptyBox}>
       لم تُجدول حصص لهذا الطالب بعد.</div>}
     </section>
     <StudentAcademicPlanCard key={learnerId} learnerId={learnerId}/>
    </div>
    <div className={styles.secondaryGrid}>
     <section className={styles.panel}>
      <div className={styles.panelHead}><div>
       <span className={styles.eyebrow}>التقدم الأكاديمي</span>
       <h2>آخر تقرير معتمد</h2></div>
       <Link className={styles.inlineLink} href="/student/progress">كل التقارير ‹</Link>
      </div>
      {last?<><div className={styles.gradeRow}>
       {([['الحفظ',last.memorization],['التلاوة',last.recitation],
        ['التجويد',last.tajweed]] as const).map(([label,grade])=>
        <div className={styles.grade} key={label}>
         <span>{label}</span><strong>{score(grade)}</strong>
        </div>)}</div>
       <p className={styles.reportNote}>{last.scope}</p>
       <small>إصدار {last.revision} المعتمد · {format.format(new Date(last.publishedAtMs))}</small>
      </>:<div className={styles.emptyBox}>
       لا يوجد تقرير منشور من الشيخ حتى الآن.</div>}
     </section>
     <section className={styles.panel}>
      <div className={styles.panelHead}><div>
       <span className={styles.eyebrow}>دفتر الحصص والتدريبات</span>
       <h2>سجل الطالب</h2></div></div>
      <p>ملاحظاتك الخاصة محفوظة في دفتر الحصص؛ الواجبات المعتمدة تظهر في تدريباتي.</p>
      <div className={styles.actionRow}>
       <Link href="/student/notebook">دفتر الحصص</Link>
       <Link href="/student/training">واجباتي المنشورة</Link>
      </div>
     </section>
    </div>
    <StudentConnectedInbox key={learnerId} learnerId={learnerId}/>
   </>}
 </>;
}
