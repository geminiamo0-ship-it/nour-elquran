'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {notebookClient,type LessonRow} from '../../shared';
import {StudentConnectedAttendanceCases} from './StudentConnectedAttendanceCases';
import {StudentTrialBooking} from './StudentTrialBooking';
import styles from '../StudentPortal.module.css';
const formatter=new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'});
export function ConnectedClassroomLessons({learnerId}:{learnerId:string}){
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
 const [lessons,setLessons]=useState<readonly LessonRow[]>([]);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const abort=new AbortController();
  setStatus('loading');setLessons([]);
  void notebookClient.lessons(learnerId,abort.signal).then(rows=>{
   if(abort.signal.aborted)return;
   setLessons(rows);setStatus('ready');
  }).catch(()=>{if(!abort.signal.aborted)setStatus('error');});
  return()=>abort.abort();
 },[learnerId,retry]);
 return <div className={styles.workspace}>
  <section className={styles.panel}>
   <div className={styles.panelHead}><div>
    <p className={styles.eyebrow}>مواعيد حساب الطالب الحقيقي</p><h2>حصصي وغرف الانتظار</h2>
   </div></div>
   <p>يمكنك فتح غرفة الانتظار للحصة المجدولة أو الجارية فقط.
    الانضمام لا يبدأ الحصة ولا يشغّل الصوت أو الفيديو.</p>
   {status==='loading'?<p role="status">جارٍ تحميل مواعيدك من الخادم...</p>:
    status==='error'?<div role="alert"><p>تعذر التحقق من المواعيد.</p>
     <button type="button" onClick={()=>setRetry(n=>n+1)}>إعادة المحاولة</button>
    </div>:!lessons.length?<p>لا توجد مواعيد حقيقية في حسابك حاليًا.</p>:
    <div className={styles.stack}>{lessons.map(l=><article key={l.id} className={styles.lessonRow}>
     <div className={styles.lessonInfo}><strong>{formatter.format(new Date(l.startsAtMs))}</strong>
      <span>{l.status==='scheduled'?'مجدولة':l.status==='live'?'جارية':
       l.status==='completed'?'مكتملة':'ملغاة'}</span></div>
     {l.status==='scheduled'||l.status==='live'?
      <Link className={styles.outlineButton} href={'/classroom/live?role=learner&lessonId='+
       encodeURIComponent(l.id)+'&learnerId='+encodeURIComponent(learnerId)}>
       فتح غرفة الانتظار</Link>:
      l.status==='completed'?<Link href="/student/notebook">دفتر الحصة</Link>:<span>غير متاح</span>}
    </article>)}</div>}
  </section>
  <StudentTrialBooking key={learnerId} learnerId={learnerId} onBooked={()=>setRetry(x=>x+1)}/>
  <StudentConnectedAttendanceCases key={learnerId} learnerId={learnerId}/>
 </div>;
}
