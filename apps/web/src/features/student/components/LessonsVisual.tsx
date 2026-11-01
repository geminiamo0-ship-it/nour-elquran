import Link from 'next/link';
import styles from './LessonsPremium.module.css';

export type DisplayLesson=Readonly<{
 id:string;
 title:string;
 time:string;
 description:string;
 status:'scheduled'|'live'|'example';
 href?:string;
}>;

const clock=<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
const calendar=<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></svg>;

export function UpcomingLessonCard({lesson}:{lesson?:DisplayLesson}){
 return <section className={styles.feature} aria-label="الحصة القادمة">
  <div className={styles.featureTop}>
   <span className={styles.eyebrow}>رحلتي مع القرآن</span>
   <span className={lesson?.status==='live'?styles.liveFlag:lesson?.status==='example'?styles.demoFlag:styles.futureFlag}>
    {lesson?.status==='live'?'الحصة جارية':lesson?.status==='example'?'موعد توضيحي':'الحصة القادمة'}
   </span>
  </div>
  <h2>{lesson?.title??'لا توجد حصص قادمة'}</h2>
  <p>{lesson?'استعد للقائك القادم مع القرآن.':'تقدر تتابع المواعيد وتطلب حصة تجريبية من أسفل الصفحة.'}</p>
  {lesson&&<div className={styles.facts}>
   <span className={styles.fact}>{calendar} {lesson.time}</span>
   <span className={styles.fact}>{clock} {lesson.description}</span>
  </div>}
  <div className={styles.featureFoot}>
   <span className={styles.note}>{lesson?.status==='example'?'هذه بيانات توضيحية للمعاينة فقط، لا توجد حصة محجوزة فعليًا.':
     lesson?.status==='live'?'الحصة جارية الآن؛ الانضمام يحتاج تحقق صلاحية الخادم.':
     lesson?'يمكنك فتح غرفة الانتظار، ويبدأ الشيخ الحصة بنفسه.':
     'موعدك القادم سيظهر هنا بمجرد تأكيد الحجز.'}</span>
   {lesson?.href&&<Link className={styles.cta} href={lesson.href}>
    {lesson.status==='live'?'دخول الحصة':'غرفة الانتظار'} <span aria-hidden="true">←</span>
   </Link>}
  </div>
 </section>;
}
export function UpcomingLessonList({lessons}:{lessons:readonly DisplayLesson[]}){
 return <section className={styles.panel} aria-label="المواعيد الأخرى">
  <div className={styles.panelHead}><h2>المواعيد الأخرى</h2><small>{lessons.length?lessons.length+' موعد':' '}</small></div>
  {lessons.length?<div className={styles.lessons}>{lessons.map(item=>
   <article key={item.id} className={styles.lessonRow}>
    <div className={styles.lessonSummary}><span className={styles.lessonMark}>{calendar}</span>
     <div className={styles.lessonInfo}><strong>{item.title}</strong><span>{item.time} · {item.description}</span></div>
    </div>
    {item.href?<Link className={styles.ghostLink} href={item.href}>غرفة الانتظار ←</Link>:
     <span className={styles.previewFoot}>موعد للعرض</span>}
   </article>)}</div>:
   <p className={styles.empty}>لا توجد مواعيد إضافية حاليًا.</p>}
 </section>;
}
