'use client';
import Link from 'next/link';
import {useMemo,useState} from 'react';
import {Panel,SectionHeading} from './TeacherUI';
import type {TeacherRosterRow,TeacherCalendarRow} from './teacher-read-api';
import styles from './TeacherPortal.module.css';
import css from './TeacherConnectedPages.module.css';

type Props={learners:readonly TeacherRosterRow[];lessons:readonly TeacherCalendarRow[]};
const lessonType={trial:'تجريبية',standard:'أساسية',makeup:'تعويضية'} as const;
const statuses={scheduled:'محجوزة',live:'جارية',completed:'مكتملة',cancelled:'ملغاة'} as const;
const formatDate=(ms:number)=>new Intl.DateTimeFormat('ar-EG',{
  timeZone:'Africa/Cairo',dateStyle:'full',timeStyle:'short',
}).format(ms);
const currentLessons=(lessons:readonly TeacherCalendarRow[],now:number)=>
  lessons.filter(l=>l.endsAtMs>now&&(l.status==='scheduled'||l.status==='live'))
    .sort((a,b)=>a.startsAtMs-b.startsAtMs);

function ScheduleRow({lesson,names}:{lesson:TeacherCalendarRow;names:ReadonlyMap<string,string>}){
  return <article className={css.scheduleRow}>
    <div className={css.scheduleText}>
      <strong>{names.get(lesson.learnerId)??lesson.learnerName??'طالب مصرح ضمن الحصة فقط'}</strong>
      <span>{lessonType[lesson.kind]} · {statuses[lesson.status]}</span>
      <time dateTime={new Date(lesson.startsAtMs).toISOString()}>{formatDate(lesson.startsAtMs)}</time>
    </div>
    <span className={css.minutes}>40 دقيقة حجز</span>
  </article>;
}
export function TeacherConnectedHome({learners,lessons}:Props){
  const names=new Map(learners.map(l=>[l.id,l.name]));
  const upcoming=currentLessons(lessons,Date.now());
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',
    month:'2-digit',day:'2-digit'}).format(Date.now());
  const dayKey=(ms:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',
    year:'numeric',month:'2-digit',day:'2-digit'}).format(ms);
  const todayCount=upcoming.filter(l=>dayKey(l.startsAtMs)===today).length;
  return <div className={css.workspace}>
    <SectionHeading eyebrow="لوحة الشيخ · Cloudflare D1" title="مساحة التدريس"
      description="طلابك وحصصك الفعلية حسب التكليفات المصرح بها فقط."
      action={<Link className={styles.primaryButton} href="/teacher/schedule">جدولي وحصصي</Link>}/>
    <div className={styles.metricGrid}>
      <article className={styles.metric}><span>طلابي المسندون حاليًا</span><strong>{learners.length}</strong>
        <small>من التعيينات الأساسية النشطة</small></article>
      <article className={styles.metric}><span>حصص اليوم القادمة</span><strong>{todayCount}</strong>
        <small>حسب توقيت القاهرة</small></article>
      <article className={styles.metric}><span>الحصص القادمة</span><strong>{upcoming.length}</strong>
        <small>ضمن الجدول المحمّل فقط</small></article>
    </div>
    <div className={styles.twoColumns}>
      <Panel title="الحصة القادمة" extra={<Link href="/teacher/schedule" className={styles.textLink}>عرض الجدول</Link>}>
        {upcoming.length?<ScheduleRow lesson={upcoming[0]!} names={names}/>:
          <p className={css.empty}>لا توجد حصة قادمة ضمن جدولك المصرح به.</p>}
      </Panel>
      <Panel title="الخطوة التعليمية التالية" extra={<Link href="/teacher/students" className={styles.textLink}>فتح طلابي</Link>}>
        <p className={css.explanation}>افتح «طلابي» لمراجعة التعيينات النشطة. ربط خطط الحفظ والتقارير والواجبات قيد التنفيذ؛ لن تظهر أرقام أو تقارير افتراضية.</p>
      </Panel>
    </div>
  </div>;
}
export function TeacherConnectedRoster({learners}:Pick<Props,'learners'>){
  const [query,setQuery]=useState('');
  const visible=useMemo(()=>{
    const normalized=query.trim().toLocaleLowerCase('ar');
    return normalized?learners.filter(x=>x.name.toLocaleLowerCase('ar').includes(normalized)):learners;
  },[learners,query]);
  return <div className={css.workspace}>
    <SectionHeading eyebrow="ملف الشيخ · D1" title="طلابي" description="طلابك المسندون إليك بصفة الشيخ الأساسي حاليًا."/>
    <Panel title="قائمة الطلاب" extra={<span className={css.count}>عدد الطلاب: {learners.length}</span>}>
      <label className={css.search}>بحث باسم الطالب
        <input type="search" aria-label="ابحث عن طالب من طلابي"
          placeholder="ابحث في طلابك" value={query} onChange={event=>setQuery(event.target.value)} />
      </label>
      {visible.length?<div className={css.rosterGrid}>{visible.map(learner=>
        <article key={learner.id} className={css.learner}>
          <span className={css.avatar} aria-hidden="true">۞</span>
          <div><strong>{learner.name}</strong>
            <small>{learner.learnerType==='child'?'ملف متعلم صغير':'ملف متعلم بالغ'}</small>
            <p>خطة الحفظ والمراجعة غير مربوطة بعد، ولا يمكن تعديلها قبل تفعيل خدمة الخطة.</p>
          </div>
        </article>)}</div>:<p className={css.empty}>{learners.length?
          'لا يوجد طالب يطابق البحث.':'لا يوجد طلاب مسندون حاليًا لهذا الشيخ.'}</p>}
    </Panel>
  </div>;
}
export function TeacherConnectedSchedule({learners,lessons}:Props){
  const [filter,setFilter]=useState<'all'|'upcoming'|'completed'|'cancelled'>('all');
  const names=new Map(learners.map(l=>[l.id,l.name]));
  const visible=useMemo(()=>{
    const now=Date.now();
    return lessons.filter(l=>filter==='all'||(filter==='upcoming'?
      ((l.status==='scheduled'||l.status==='live')&&l.endsAtMs>now):l.status===filter))
      .slice().sort((a,b)=>a.startsAtMs-b.startsAtMs);
  },[lessons,filter]);
  return <div className={css.workspace}>
    <SectionHeading eyebrow="جدولي وحصصي · D1" title="جدول الحصص"
      description="المواعيد المعتمدة بتوقيت القاهرة. الدخول للفصل وإعادة الجدولة قيد الربط."/>
    <Panel title="الحصص المسجلة" extra={<span className={css.count}>{visible.length} حصة</span>}>
      <div className={css.filters} role="group" aria-label="تصفية حصصي">
        {([{id:'all',label:'الكل'},{id:'upcoming',label:'القادمة'},
          {id:'completed',label:'المكتملة'},{id:'cancelled',label:'الملغاة'}] as const)
          .map(item=><button type="button" key={item.id} aria-pressed={filter===item.id}
            className={filter===item.id?css.filterActive:css.filter} onClick={()=>setFilter(item.id)}>
            {item.label}</button>)}
      </div>
      {visible.length?<div className={css.list}>{visible.map(l=><ScheduleRow key={l.id} lesson={l} names={names}/>)}</div>:
        <p className={css.empty}>لا توجد حصص في هذه الحالة.</p>}
      <p className={css.explanation}>تغيير أو إلغاء المواعيد، وبدء الحصة، لا يتمان من هذه الواجهة حتى اعتماد وربط الخدمات المؤمنة.</p>
    </Panel>
  </div>;
}
