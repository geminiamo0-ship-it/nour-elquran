'use client';
import {useEffect,useRef,useState} from 'react';
import {trialBookingClient,type TrialSlot} from '../../shared';
import styles from '../StudentPortal.module.css';

const format=new Intl.DateTimeFormat('ar-EG',{
 timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'
});
/** A replacement must preserve the confirmed lesson when the new slot fails. */
export function StudentTrialReschedule({learnerId,lessonId,startsAtMs,onRescheduled}:{
 learnerId:string;lessonId:string;startsAtMs:number;onRescheduled:()=>void
}){
 const [open,setOpen]=useState(false);
 const [phase,setPhase]=useState<'loading'|'ready'|'error'>('loading');
 const [slots,setSlots]=useState<readonly TrialSlot[]>([]);
 const [busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false);
 const [message,setMessage]=useState('');
 const [retry,setRetry]=useState(0);
 const attempt=useRef<{slotId:string;operationId:string}|null>(null);
 const inFlight=useRef(false);
 const early=startsAtMs>=Date.now()+6*3600000;
 useEffect(()=>{
  if(!open)return;
  const ctrl=new AbortController();
  setPhase('loading');setSlots([]);
  void trialBookingClient.rescheduleSlots(learnerId,lessonId,ctrl.signal)
   .then(items=>{if(!ctrl.signal.aborted){setSlots(items);setPhase('ready');}})
   .catch(()=>{if(!ctrl.signal.aborted)setPhase('error');});
  return()=>ctrl.abort();
 },[open,learnerId,lessonId,retry]);
 async function choose(slotId:string){
  if(inFlight.current||busy||uncertain||!early||phase!=='ready'||
    !slots.some(s=>s.slotId===slotId))return;
  if(!attempt.current||attempt.current.slotId!==slotId)
   attempt.current={slotId,operationId:crypto.randomUUID()};
  inFlight.current=true;setBusy(true);setMessage('');
  try{
   await trialBookingClient.reschedule(learnerId,lessonId,slotId,attempt.current.operationId);
   attempt.current=null;setOpen(false);setMessage('');
   onRescheduled();
  }catch{
   // The server may have committed the event before the network failed;
   // do not retry with a new UUID without reading signed lessons again.
   setUncertain(true);
   setMessage('لم نتمكن من تأكيد التغيير؛ حدث «حصصي» للتحقق من الموعد الحالي قبل أي محاولة جديدة.');
  }finally{inFlight.current=false;setBusy(false);}
 }
 if(!early)return null;
 return <div className={styles.actionRow} dir="rtl">
  {!open?<button type="button" className={styles.outlineButton}
   onClick={()=>setOpen(true)}>تغيير موعد التجربة</button>:<div className={styles.panel}
   aria-label="تغيير موعد الحصة التجريبية">
   <strong>اختر موعدًا بديلًا متاحًا</strong>
   <p>لن يُلغى موعدك الحالي إلا إذا نجح حجز البديل على الخادم في نفس العملية.</p>
   {phase==='loading'?<p role="status">جارٍ التحقق من المواعيد المتاحة…</p>:
    phase==='error'?<p role="alert">تعذّر التحقق من البدائل. موعدك الحالي لم يتغير.</p>:
    slots.length===0?<p>لا توجد مواعيد بديلة منشورة حاليًا.</p>:
    <div className={styles.stack}>{slots.slice(0,12).map(slot=>
     <div className={styles.lessonRow} key={slot.slotId}>
      <span>{format.format(new Date(slot.startsAtMs))}</span>
      <button type="button" className={styles.actionButton}
       disabled={busy||uncertain} onClick={()=>void choose(slot.slotId)}>
       {busy?'جارٍ التأكيد…':'تأكيد الموعد الجديد'}</button>
     </div>)}</div>}
   <button type="button" className={styles.outlineButton} disabled={busy}
    onClick={()=>{setOpen(false);setMessage('');setUncertain(false);attempt.current=null;}}>
     العودة للموعد الحالي</button>
   {!uncertain&&<button type="button" className={styles.outlineButton} disabled={busy}
    onClick={()=>setRetry(n=>n+1)}>تحديث البدائل</button>}
   {message&&<p role="alert">{message}</p>}
  </div>}
 </div>;
}
