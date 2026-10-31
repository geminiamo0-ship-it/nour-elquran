'use client';
import {useEffect,useRef,useState} from 'react';
import {trialBookingClient,TrialBookingError,type TrialAvailability} from '../../shared';
import styles from '../StudentPortal.module.css';
type View={phase:'loading'|'ready'|'error';availability:TrialAvailability|null};
const format=new Intl.DateTimeFormat('ar-EG',{
 timeZone:'Africa/Cairo',dateStyle:'full',timeStyle:'short'
});
export function StudentTrialBooking({learnerId,onBooked,refreshRevision}:{
 learnerId:string;onBooked:()=>void;refreshRevision:number;
}){
 const [view,setView]=useState<View>({phase:'loading',availability:null});
 const [retry,setRetry]=useState(0),[busy,setBusy]=useState<string|null>(null);
 const [uncertain,setUncertain]=useState(false),[message,setMessage]=useState('');
 const attempt=useRef<{slotId:string;operationId:string}|null>(null);
 useEffect(()=>{
  const abort=new AbortController();
  setView({phase:'loading',availability:null});setMessage('');setUncertain(false);
  void trialBookingClient.availability(learnerId,abort.signal).then(availability=>{
   if(!abort.signal.aborted)setView({phase:'ready',availability});
  }).catch(()=>{
   if(!abort.signal.aborted)setView({phase:'error',availability:null});
  });
  return()=>abort.abort();
 },[learnerId,retry,refreshRevision]);
 async function book(slotId:string){
  if(busy||uncertain||view.phase!=='ready'||!view.availability?.eligible||
   !view.availability.slots.some(s=>s.slotId===slotId))return;
  if(!attempt.current||attempt.current.slotId!==slotId)
   attempt.current={slotId,operationId:crypto.randomUUID()};
  setBusy(slotId);setMessage('');
  try{
   await trialBookingClient.book(learnerId,slotId,attempt.current.operationId);
   attempt.current=null;
   setMessage('تم تأكيد حجز الحصة التجريبية من الخادم؛ ستظهر ضمن حصصي.');
   setView({phase:'loading',availability:null});
   onBooked();
   setRetry(n=>n+1);
  }catch(error){
   const definitelyUnavailable=error instanceof TrialBookingError&&error.status===409;
   // Do not assert a new booking failed or succeeded when the request may
   // already have reached D1; use a fresh owner-scoped read before retry.
   setUncertain(true);
   setMessage(definitelyUnavailable?
    'هذا الموعد لم يعد متاحًا أو سبق حجز التجربة. حدّث المواعيد للتحقق.':
    'لم نتمكن من تأكيد الحجز؛ تحقق من «حصصي» وحدّث القائمة قبل أي محاولة أخرى.');
  }finally{setBusy(null);}
 }
 return <section className={styles.panel} dir="rtl" aria-label="حجز الحصة التجريبية">
  <div className={styles.panelHead}><div>
   <span className={styles.eyebrow}>مرة واحدة لكل طالب</span>
   <h2>الحصة التجريبية المجانية</h2></div>
   <button type="button" className={styles.outlineButton} disabled={busy!==null}
    onClick={()=>{attempt.current=null;setRetry(v=>v+1);}}>تحديث المواعيد</button>
  </div>
  <p>حصة مجانية 30 دقيقة مع الشيخ، ويُحجز لها 40 دقيقة في الجدول.
   المواعيد من الإدارة والخادم فقط، وتُحدَّد هوية الشيخ تلقائيًا.</p>
  {view.phase==='loading'?<p role="status">جارٍ التحقق من استحقاق التجربة والمواعيد…</p>:
   view.phase==='error'?<p role="alert">تعذّر التحقق من المواعيد الحقيقية؛ لا توجد أوقات تجريبية بديلة.</p>:
   !view.availability?.eligible?<p role="status">هناك حصة تجريبية حالية أو مُستخدمة لهذا الطالب؛
    لن نعرض تجربة مجانية ثانية تلقائيًا.</p>:
   view.availability.slots.length===0?<p className={styles.emptyBox}>
    لا توجد مواعيد تجريبية منشورة ومتاحة حاليًا لهذا الطالب.</p>:
   <div className={styles.stack}>{view.availability.slots.slice(0,12).map(slot=>
    <article className={styles.lessonRow} key={slot.slotId}>
     <div className={styles.lessonInfo}><strong>{format.format(new Date(slot.startsAtMs))}</strong>
      <span>30 دقيقة تعليم · 40 دقيقة في الجدول</span></div>
     <button type="button" className={styles.actionButton}
      disabled={busy!==null||uncertain} onClick={()=>void book(slot.slotId)}>
      {busy===slot.slotId?'جارٍ تأكيد الحجز…':'احجز التجربة'}</button>
    </article>)}</div>}
  {message&&<p role={uncertain?'alert':'status'}>{message}</p>}
  <small>لا تخصم هذه التجربة من أي رصيد مدفوع. لا تبدأ الحصة تلقائيًا؛
   الشيخ يبدأها من غرفة الانتظار. تعديل موعد الحجز أو إلغاؤه يحتاج مسارًا مُعتمدًا.</small>
 </section>;
}
