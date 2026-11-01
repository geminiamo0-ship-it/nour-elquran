'use client';
import Link from 'next/link';
import css from './StudentPremium.module.css';

export type HomeLesson={time:string;kind?:string;href:string;action:string;live?:boolean};
export type HomeTask={id:string;label:string;kind:string};
export type HomeGrade={label:string;value:string};
export function PremiumHome({name,lesson,tasks,grades,preview=false,basePath='/student'}:{
 name:string;lesson?:HomeLesson;tasks:readonly HomeTask[];grades:readonly HomeGrade[];
 preview?:boolean;basePath?:string;
}){
 const primary=lesson?.live?'lesson':tasks.length?'task':lesson?'lesson':'new';
 const taskHref=tasks.length&&!preview?basePath+'/training#assignment-'+encodeURIComponent(tasks[0]!.id):basePath+'/training';
 return <div dir="rtl">
  <section className={css.hero} aria-label="مرحبًا بك في نور القرآن">
   <div><h1>مرحبًا بك يا {name}</h1>
    <p>مبارك عليك رحلتك مع كتاب الله ♡</p></div>
   <span className={css.heroVisual} aria-hidden="true"/>
  </section>
  <div className={css.homeGrid}>
   <section className={css.lessonCard} aria-label="الحصص والجدول">
    <div className={css.cardHeading}>
     <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 10h18"/></svg>
     <h2>حصتي القادمة</h2>
    </div>
    {lesson?<><p className={css.cardSub}>{lesson.live?'الحصة جارية الآن':'موعد الحصة المعتمد'}</p>
     <div className={css.lessonFacts}><span>{lesson.time}</span>{lesson.kind&&<span>{lesson.kind}</span>}</div>
     <Link href={lesson.href} className={css.primaryGold}>{lesson.action} <span aria-hidden="true">◀</span></Link>
    </>:<><p className={css.cardSub}>لا توجد حصة مجدولة الآن. ابدأ رحلتك من صفحة الحصص.</p>
     <Link href={basePath+"/lessons"} className={css.primaryGold}>عرض المواعيد والحجز <span aria-hidden="true">◀</span></Link></>}
   </section>
   <section className={css.wirdCard} aria-label="وردي اليومي">
    <div className={css.cardHeading}>
     <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 6c-3-2-7-2-10-1v14c4-1 8-1 10 2 2-3 6-3 10-2V5c-3-1-7-1-10 1Zm0 0v15"/></svg>
     <h2>وردي اليومي</h2>
    </div>
    <p className={css.cardSub}>الحفظ والمراجعة المطلوبة</p>
    {tasks.length?<div className={css.wirdRows}>
     {tasks.slice(0,2).map(task=><div className={css.wirdRow} key={task.id}>
      <strong>{task.kind}</strong><span>{task.label}</span></div>)}
    </div>:<p className={css.emptyWird}>لم ينشر الشيخ واجبًا بعد. يمكنك بدء حفظ أو مراجعة ذاتية من تدريباتي.</p>}
    <Link className={css.primaryGreen} href={taskHref}>
     {primary==='task'?'ابدأ واجبي الآن':'ابدأ تدريبي الآن'} <span aria-hidden="true">◀</span></Link>
   </section>
  </div>
  <div className={css.quickGrid} aria-label="روابط سريعة">
   <Link className={css.quickLink} href={basePath+"/mushaf"}>
    <svg width="33" height="33" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 6C9 4 5 4 2 5v14c4-1 8-1 10 2 2-3 6-3 10-2V5c-3-1-7-1-10 1Zm0 0v15"/></svg>
    <div><strong>المصحف</strong><span>قراءة وتلاوة وتدبر</span></div></Link>
   <Link className={css.quickLink} href={basePath+"/training"}>
    <svg width="33" height="33" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="4"/><path d="m11 13 10-10m-6 0h6v6"/></svg>
    <div><strong>تدريباتي</strong><span>الواجبات والتسميع</span></div></Link>
   <Link className={css.quickLink} href={basePath+"/lessons#notebook"}>
    <svg width="33" height="33" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h8M8 17h5"/></svg>
    <div><strong>سجل الحصص</strong><span>التقارير والتقييمات</span></div></Link>
  </div>
  <div className={css.homeBottom}>
   <section className={css.softCard}>
    <h2>آخر تقرير معتمد</h2>
    {grades.length?<div className={css.gradeSummary}>
      {grades.map(g=><div key={g.label}><span>{g.label}</span><strong>{g.value}</strong></div>)}
     </div>:<p>لم يُنشَر أي تقرير بعد. سيظهر تقييم الشيخ بعد اعتماد أول تقرير.</p>}
    <p><Link href={basePath+"/lessons#reports"} className={css.cardLink}>عرض تقاريري وتقدمي ←</Link></p>
   </section>
   <section className={css.softCard}>
    <h2>خطوتي التالية</h2>
    <p>{preview?'هذه بيانات معاينة توضيحية.':primary==='lesson'&&lesson?.live?
     'شيخك بدأ الحصة؛ يمكنك دخول الغرفة الآن.':primary==='task'?
     'لديك تكليف معتمد من الشيخ يمكنك البدء فيه.':lesson?
     'تابع موعد حصتك واستعد لها من تدريباتي.':
     'ابدأ بحجز حصتك الأولى، أو افتح المصحف للقراءة.'}</p>
    <Link className={css.cardLink} href={primary==='lesson'&&lesson?lesson.href:primary==='task'?taskHref:lesson?basePath+'/lessons':basePath+'/mushaf'}>
     {primary==='lesson'&&lesson?lesson.action:primary==='task'?'ابدأ الواجب':lesson?'عرض الحصص':'افتح المصحف'} ←
    </Link>
   </section>
  </div>
 </div>;
}
