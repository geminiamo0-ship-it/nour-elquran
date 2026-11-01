'use client';
import {useEffect,useState} from 'react';
import {assignmentClient,lessonReportsClient,notebookClient,
 type LessonRow,type PublishedAssignment,type StudentReport} from '../shared';
import {PremiumHome,type HomeTask} from './PremiumHome';
import css from './StudentPremium.module.css';

type Read={status:'loading'}|{status:'error'}|{
 status:'ready';lessons:readonly LessonRow[];tasks:readonly PublishedAssignment[];reports:readonly StudentReport[];
};
const tasksClient=assignmentClient();
const formatter=new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'});
const score=(n:number|null)=>n===null?'لم يُقيّم':n+' / 10';
/** No mocked lessons or derived fake progress for authenticated learners. */
export function ConnectedStudentDashboard({learnerId,name}:{learnerId:string;name:string}){
 const [data,setData]=useState<Read>({status:'loading'});
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setData({status:'loading'});
  void Promise.all([
   notebookClient.lessons(learnerId,controller.signal),
   tasksClient.owner(learnerId,controller.signal),
   lessonReportsClient.student(learnerId,controller.signal)
  ]).then(([lessons,tasks,reports])=>{
   if(!controller.signal.aborted)setData({status:'ready',
    lessons:lessons.filter(l=>l.learnerId===learnerId),
    tasks:tasks.filter(t=>t.learnerId===learnerId),
    reports:reports.filter(r=>r.learnerId===learnerId)});
  }).catch(()=>{if(!controller.signal.aborted)setData({status:'error'});});
  return()=>controller.abort();
 },[learnerId,reload]);
 if(data.status==='loading')return <section className={css.loadingCard} role="status">
  <h1>مرحبًا بك يا {name}</h1>جارٍ تحميل بيانات الطالب الموثقة من الخادم…</section>;
 if(data.status==='error')return <section className={css.errorCard} role="alert">
  <h2>تعذّر تحميل بيانات الطالب</h2>
  <p>بيانات الحصص والتقارير لا تُستبدل بمعلومات تجريبية أو أرقام فارغة.</p>
  <button type="button" onClick={()=>setReload(n=>n+1)}>إعادة المحاولة</button>
 </section>;
 const upcoming=data.lessons.filter(l=>(
  (l.status==='scheduled'||l.status==='live')&&l.endsAtMs>Date.now()
 )).sort((a,b)=>(a.status==='live'?0:1)-(b.status==='live'?0:1)||a.startsAtMs-b.startsAtMs);
 const next=upcoming[0];
 const lesson=next?{
  time:formatter.format(new Date(next.startsAtMs)),
  kind:next.kind==='trial'?'تجريبية':next.kind==='makeup'?'تعويضية':'حفظ ومراجعة',
  href:next.status==='live'?'/classroom/live?role=learner&lessonId='+encodeURIComponent(next.id)+
   '&learnerId='+encodeURIComponent(learnerId):'/student/lessons',
  action:next.status==='live'?'دخول الحصة':'عرض موعد الحصة',
  live:next.status==='live'
 }:undefined;
 const tasks:HomeTask[]=data.tasks.slice().sort((a,b)=>a.dueAtMs-b.dueAtMs).map(t=>({
  id:t.id,kind:t.kind==='memorization'?'حفظ':t.kind==='revision'?'مراجعة':'تلاوة',
  label:'سورة رقم '+t.surah+' · الآيات '+t.fromAyah+'–'+t.toAyah
 }));
 const report=data.reports.slice().sort((a,b)=>b.publishedAtMs-a.publishedAtMs)[0];
 const grades=report?[
  {label:'الحفظ',value:score(report.memorization)},
  {label:'التلاوة',value:score(report.recitation)},
  {label:'التجويد',value:score(report.tajweed)}
 ]:[];
 return <PremiumHome name={name} lesson={lesson} tasks={tasks} grades={grades}/>;
}
