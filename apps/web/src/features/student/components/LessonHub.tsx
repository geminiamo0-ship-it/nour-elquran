'use client';
import {useEffect,useState} from 'react';
import {useStudent} from '../StudentContext';
import {ConnectedClassroomLessons} from './ConnectedClassroomLessons';
import {NotebookWorkspace} from './NotebookWorkspace';
import {ProgressWorkspace} from './ProgressWorkspace';
import {UpcomingLessonCard,UpcomingLessonList,type DisplayLesson} from './LessonsVisual';
import styles from './LessonsPremium.module.css';

type LessonView='schedule'|'notebook'|'reports';
const tabs=[
 {id:'schedule',label:'القادمة'},
 {id:'notebook',label:'سجل الحصص'},
 {id:'reports',label:'التقارير'},
] as const;

function DemoSchedule(){
 const {selected}=useStudent();
 // Mock sessions exist only in the explicit /preview/student route.
 const upcoming=selected.lessons.filter(l=>l.status==='booked'&&l.dayOffset>=0)
  .slice().sort((a,b)=>a.dayOffset-b.dayOffset||a.time.localeCompare(b.time));
 const mapped:DisplayLesson[]=upcoming.map(l=>({
  id:l.id,title:l.topic,
  time:l.dayOffset===0?'اليوم · '+l.time:'بعد '+l.dayOffset+' يوم · '+l.time,
  description:l.kind==='trial'?'حصة تجريبية · 30 دقيقة':'حفظ ومراجعة · '+l.durationMinutes+' دقيقة',
  status:'example'
 }));
 return <div className={styles.schedule}>
  <UpcomingLessonCard lesson={mapped[0]}/>
  {mapped.length>1&&<UpcomingLessonList lessons={mapped.slice(1)}/>}
  <p className={styles.previewFoot}>المواعيد المعروضة أمثلة لتقييم التصميم، وليست حجوزات أو طلبات فعلية.</p>
 </div>;
}

/** Single student-facing hub. Data and detailed workflows are unchanged behind the tabs. */
export function LessonHub({initialTab='schedule'}:{initialTab?:LessonView}){
 const {selected}=useStudent();
 const [tab,setTab]=useState<LessonView>(initialTab);
 useEffect(()=>{
  const sync=()=>{
   const hash=window.location.hash.slice(1);
   if(hash==='reports'||hash==='notebook'||hash==='schedule')setTab(hash);
  };
  sync();
  window.addEventListener('hashchange',sync);
  return()=>window.removeEventListener('hashchange',sync);
 },[]);
 function change(next:LessonView){
  setTab(next);
  window.history.replaceState(null,'',window.location.pathname+'#'+next);
 }
 return <div className={styles.page} dir="rtl">
  <header className={styles.intro}>
   <div><h1>حصصي</h1><p>مواعيدي، حصصي السابقة، وتقارير الشيخ في مكان واحد.</p></div>
   <span className={styles.introIcon} aria-hidden="true">
    <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></svg>
   </span>
  </header>
  <nav className={styles.tabs} aria-label="عرض حصصي">
   {tabs.map(item=><button key={item.id} type="button" aria-pressed={tab===item.id}
    className={tab===item.id?styles.tabActive:styles.tab}
    onClick={()=>change(item.id)}>{item.label}</button>)}
  </nav>
  {tab==='schedule'?
    (selected.profile.demo?<DemoSchedule/>:
      <ConnectedClassroomLessons key={selected.profile.id} learnerId={selected.profile.id}/>):
   <div className={styles.embedded}>
    {tab==='notebook'?<NotebookWorkspace key={'notebook-'+selected.profile.id}/>:
      <ProgressWorkspace key={'reports-'+selected.profile.id}/>}
   </div>}
 </div>;
}
