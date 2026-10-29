import Link from 'next/link';
import type {ReactNode} from 'react';
import {LESSON_LABEL,KIND_LABEL,type TeacherLesson,type TeacherLearner} from './domain';
import styles from './TeacherPortal.module.css';

export function SectionHeading({eyebrow,title,description,action}:{
  eyebrow:string;title:string;description:string;action?:ReactNode;
}){
  return <header className={styles.sectionHeading}>
    <div><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
    {action&&<div className={styles.headingAction}>{action}</div>}
  </header>;
}
export function Panel({title,extra,children,compact=false}:{title:string;extra?:ReactNode;children:ReactNode;compact?:boolean}){
  return <section className={compact?styles.panelCompact:styles.panel}>
    <div className={styles.panelTitle}><h2>{title}</h2>{extra}</div>{children}
  </section>;
}
export function Pill({tone='neutral',children}:{tone?:'neutral'|'good'|'warning'|'danger'|'blue';children:ReactNode}){
  const tones={neutral:styles.pillNeutral,good:styles.pillGood,warning:styles.pillWarning,danger:styles.pillDanger,blue:styles.pillBlue};
  return <span className={`${styles.pill} ${tones[tone]}`}>{children}</span>;
}
export function Empty({title,description,action}:{title:string;description:string;action?:ReactNode}){
  return <div className={styles.empty}><span aria-hidden="true">۞</span><strong>{title}</strong><p>{description}</p>{action}</div>;
}
export function TeacherLessonCard({lesson,learner,showActions=true}:{lesson:TeacherLesson;learner:TeacherLearner|undefined;showActions?:boolean}){
  const statusTone=lesson.status==='live'?'good':lesson.status==='cancelled'?'danger':lesson.status==='waiting'?'warning':'neutral';
  return <article className={styles.lessonCard}>
    <div className={styles.lessonTime}><b>{lesson.startsAt}</b><span>إلى {lesson.reservedUntil}</span><small>حجز ٤٠ دقيقة</small></div>
    <div className={styles.lessonBody}><strong>{learner?.name??'ملف طالب غير متاح'}</strong>
      <span>{KIND_LABEL[lesson.kind]} · {lesson.day} · {lesson.date}</span>
      <div className={styles.inlineBadges}><Pill tone={statusTone}>{LESSON_LABEL[lesson.status]}</Pill>
        {lesson.isSubstitute&&<Pill tone="blue">حصة بديلة · موافقة ولي الأمر</Pill>}
      </div>
    </div>
    {showActions&&<div className={styles.lessonActions}>
      <Link href="/teacher/preparation" className={styles.secondaryButton}>تحضير الحصة</Link>
      <Link href="/teacher/schedule" className={styles.textLink}>التفاصيل</Link>
    </div>}
  </article>;
}
export function LessonStatusHelp(){
  return <p className={styles.helpText}>موعد الجدول محجوز ٤٠ دقيقة، والوقت التعليمي الأساسي ٣٠ دقيقة. بدء الفصل وإنهاؤه بيد الشيخ فقط، ولا يتم إنهاؤه آليًا.</p>;
}
