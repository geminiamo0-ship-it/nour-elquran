'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {assignmentClient,type PublishedAssignment} from '../shared';
import {TeacherAcademicPlanEditor} from './TeacherAcademicPlanEditor';
import type {TeacherCalendarRow,TeacherRosterRow} from './teacher-read-api';
import css from './TeacherReadOnly.module.css';
const client=assignmentClient();
const clock=new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',
 dateStyle:'medium',timeStyle:'short'});
type Read={status:'loading'}|{status:'failed'}|
 {status:'ready';tasks:readonly PublishedAssignment[]};
export function TeacherConnectedPreparation({learners,lessons}:{
 learners:readonly TeacherRosterRow[];
 lessons:readonly TeacherCalendarRow[];
}){
 const relevant=lessons.filter(l=>l.status==='scheduled'||l.status==='live')
  .slice().sort((a,b)=>a.startsAtMs-b.startsAtMs);
 const [selectedId,setSelectedId]=useState('');
 const [data,setData]=useState<Read>({status:'loading'});
 const [retry,setRetry]=useState(0);
 const lesson=relevant.find(l=>l.id===selectedId)??relevant[0];
 const learnerId=lesson?.learnerId;
 useEffect(()=>{
  if(!learnerId){setData({status:'ready',tasks:[]});return;}
  const controller=new AbortController();setData({status:'loading'});
  void client.teacher(learnerId,controller.signal).then(tasks=>{
   if(!controller.signal.aborted)setData({status:'ready',tasks});
  }).catch(()=>{if(!controller.signal.aborted)setData({status:'failed'});});
  return()=>controller.abort();
 },[learnerId,retry]);
 const name=learners.find(l=>l.id===learnerId)?.name??lesson?.learnerName??'طالب الحصة';
 return <section className={css.card} aria-label="تحضير الحصة الموثقة">
  <div className={css.heading}><h1>التحضير للحصة</h1>
   <span>من الجدول المعتمد على D1</span></div>
  {!lesson?<p className={css.empty}>لا توجد حصة مجدولة أو جارية مصرح بها حاليًا.
   لا نعرض تحضيرًا أو موعدًا افتراضيًا.</p>:<>
   <label htmlFor="connected-preparation-lesson">اختر الحصة الفعلية</label>
   <select id="connected-preparation-lesson" value={lesson.id}
    onChange={e=>setSelectedId(e.target.value)}>
    {relevant.map(l=><option key={l.id} value={l.id}>
     {(learners.find(x=>x.id===l.learnerId)?.name??l.learnerName??'طالب الحصة')+
      ' · '+clock.format(new Date(l.startsAtMs))}
    </option>)}
   </select>
   <p>الطالب: <strong>{name}</strong></p>
   <p>الوقت: {clock.format(new Date(lesson.startsAtMs))}</p>
   <div className={css.actions}>
    <Link href={'/classroom/live?role=teacher&lessonId='+
     encodeURIComponent(lesson.id)}>فتح الفصل الحقيقي</Link>
    <Link href="/teacher/assignments">إدارة الواجبات</Link>
    <Link href="/teacher/reports">تقارير الحصص</Link>
   </div>
   {learnerId&&<TeacherAcademicPlanEditor key={learnerId}
    learnerId={learnerId} learnerName={name}/>}
   <h2>واجبات الطالب المنشورة</h2>
   {data.status==='loading'?<p role="status">جارٍ تحميل واجبات الطالب…</p>:
    data.status==='failed'?<div role="alert">
     <p>تعذر التحقق من واجبات الطالب؛ لن نعرض واجبات قديمة أو مفترضة.</p>
     <button type="button" onClick={()=>setRetry(n=>n+1)}>إعادة التحميل</button>
    </div>:data.tasks.length?<div className={css.list}>{data.tasks.map(t=>
     <div className={css.row} key={t.id}>
      <strong>سورة {t.surah} · {t.fromAyah}–{t.toAyah}</strong>
      <p>{t.instructions}</p>
     </div>)}</div>:
     <p className={css.empty}>لم ينشر الشيخ واجبًا لهذا الطالب بعد.</p>}
  </>}
 </section>;
}
