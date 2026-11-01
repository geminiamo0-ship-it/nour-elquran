'use client';
import {useEffect,useState} from 'react';
import {notebookClient,type LessonRow} from '../../shared';
import {StudentConnectedAttendanceCases} from './StudentConnectedAttendanceCases';
import {StudentTrialBooking} from './StudentTrialBooking';
import {StudentTrialCancellation} from './StudentTrialCancellation';
import {StudentTrialReschedule} from './StudentTrialReschedule';
import {StudentPaidSlotStatus} from './StudentPaidSlotStatus';
import {UpcomingLessonCard,UpcomingLessonList,type DisplayLesson} from './LessonsVisual';
import css from './LessonsPremium.module.css';

const formatted=new Intl.DateTimeFormat('ar-EG',{
 timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'
});
const label=(kind:LessonRow['kind'])=>kind==='trial'?'حصة تجريبية':
 kind==='makeup'?'حصة تعويضية':'حفظ ومراجعة';
function view(lesson:LessonRow,learnerId:string):DisplayLesson{
 return {
  id:lesson.id,
  title:label(lesson.kind),
  time:formatted.format(new Date(lesson.startsAtMs)),
  description:'حصة '+(lesson.kind==='trial'?'تجريبية':'تعليمية')+' · 30 دقيقة',
  status:lesson.status==='live'?'live':'scheduled',
  // The authenticated Worker validates time, account and lesson membership again.
  href:'/classroom/live?role=learner&lessonId='+encodeURIComponent(lesson.id)+
   '&learnerId='+encodeURIComponent(learnerId)
 };
}

export function ConnectedClassroomLessons({learnerId}:{learnerId:string}){
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
 const [lessons,setLessons]=useState<readonly LessonRow[]>([]);
 const [retry,setRetry]=useState(0);
 const [availabilityRevision,setAvailabilityRevision]=useState(0);
 const [bookingOpen,setBookingOpen]=useState(false);
 const [attendanceOpen,setAttendanceOpen]=useState(false);
 useEffect(()=>{
  const abort=new AbortController();
  setStatus('loading');setLessons([]);
  void notebookClient.lessons(learnerId,abort.signal).then(rows=>{
   if(abort.signal.aborted)return;
   setLessons(rows.filter(l=>l.learnerId===learnerId));setStatus('ready');
  }).catch(()=>{if(!abort.signal.aborted)setStatus('error');});
  return()=>abort.abort();
 },[learnerId,retry]);
 const upcoming=lessons.filter(l=>(l.status==='scheduled'||l.status==='live')&&
  l.endsAtMs>Date.now()).slice().sort((a,b)=>{
    if(a.status!==b.status)return a.status==='live'?-1:1;
    return a.startsAtMs-b.startsAtMs;
  });
 const next=upcoming[0];
 return <div className={css.schedule}>
  {status==='loading'?<section className={css.emptyState} role="status">جارٍ تحميل مواعيدك…</section>:
   status==='error'?<section className={css.emptyState} role="alert">
    <p>تعذّر تحميل المواعيد، ولن نعرض مواعيد بديلة غير مؤكدة.</p>
    <button type="button" className={css.ghostLink} onClick={()=>setRetry(x=>x+1)}>إعادة المحاولة</button>
   </section>:<>
    <UpcomingLessonCard lesson={next?view(next,learnerId):undefined}/>
    {upcoming.length>1&&<UpcomingLessonList lessons={upcoming.slice(1).map(l=>view(l,learnerId))}/>}
    {next?.kind==='trial'&&next.status==='scheduled'&&
     <section className={css.panel} aria-label="تعديل موعد الحصة">
      <div className={css.panelHead}><h2>تعديل موعد التجربة</h2></div>
      <div className={css.controls}>
       <StudentTrialReschedule learnerId={learnerId} lessonId={next.id}
        startsAtMs={next.startsAtMs} onRescheduled={()=>setRetry(x=>x+1)}/>
       <StudentTrialCancellation learnerId={learnerId} lessonId={next.id}
        startsAtMs={next.startsAtMs} onCancelled={()=>{
         setRetry(x=>x+1);setAvailabilityRevision(x=>x+1);
        }}/>
      </div>
     </section>}
   </>}
  <details className={css.expansion} id="lesson-booking" onToggle={e=>setBookingOpen(e.currentTarget.open)}>
   <summary>حجز حصة تجريبية</summary>
   {bookingOpen&&<div className={css.expansionBody}>
    <StudentTrialBooking key={learnerId} learnerId={learnerId}
      refreshRevision={availabilityRevision} onBooked={()=>setRetry(x=>x+1)}/>
   </div>}
  </details>
  <StudentPaidSlotStatus key={learnerId} learnerId={learnerId}/>
  <details className={css.expansion} onToggle={e=>setAttendanceOpen(e.currentTarget.open)}>
   <summary>الحضور وطلبات المراجعة</summary>
   {attendanceOpen&&<div className={css.expansionBody}>
    <StudentConnectedAttendanceCases key={learnerId} learnerId={learnerId}/>
   </div>}
  </details>
 </div>;
}
