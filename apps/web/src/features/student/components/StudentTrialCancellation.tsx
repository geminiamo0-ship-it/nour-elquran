'use client';
import {useRef,useState} from 'react';
import {trialBookingClient} from '../../shared';
import styles from '../StudentPortal.module.css';

/** Releasing a confirmed first trial needs an explicit guardian action.
 * A cancellation is never implied by closing the browser or leaving LiveKit.
 */
export function StudentTrialCancellation({learnerId,lessonId,startsAtMs,onCancelled}:{
 learnerId:string;lessonId:string;startsAtMs:number;onCancelled:()=>void;
}){
 const [confirm,setConfirm]=useState(false);
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [error,setError]=useState('');
 const inFlight=useRef(false);
 const operation=useRef<string|null>(null);
 const eligible=startsAtMs>=Date.now()+6*3600000;
 async function cancel(){
  if(inFlight.current||busy||uncertain||!confirm||!eligible)return;
  inFlight.current=true;setBusy(true);setError('');
  if(!operation.current)operation.current=crypto.randomUUID();
  try{
   await trialBookingClient.cancel(learnerId,lessonId,operation.current);
   setConfirm(false);operation.current=null;
   onCancelled(); // Parent re-fetches the authoritative child lesson list.
  }catch{
   // Do not promise that a timed-out cancellation did not reach D1.
   // Caller must reload signed lessons to verify whether it was committed.
   setUncertain(true);
   setError('نتيجة الإلغاء غير مؤكدة. حدث قائمة حصصي للتحقق قبل أي محاولة جديدة.');
  }finally{inFlight.current=false;setBusy(false);}
 }
 if(!eligible)return <small>الإلغاء الذاتي يتطلب 6 ساعات على الأقل قبل الحصة.
  للاستثناء تواصل مع الإدارة؛ لا يُلغى الموعد تلقائيًا.</small>;
 return <div className={styles.actionRow}>
  {!confirm?<button className={styles.outlineButton} type="button"
   onClick={()=>setConfirm(true)}>إلغاء الحصة التجريبية</button>:<>
   <span>هل تريد إلغاء الحجز؟ لن تُحسب حصة مكتملة، ويمكنك حجز تجربة أخرى من المواعيد المتاحة.</span>
   <button className={styles.actionButton} type="button" disabled={busy||uncertain}
    onClick={()=>void cancel()}>{busy?'جارٍ التأكيد…':'تأكيد الإلغاء'}</button>
   <button className={styles.outlineButton} type="button" disabled={busy}
    onClick={()=>setConfirm(false)}>الاحتفاظ بالحجز</button>
  </>}
  {error&&<p role="alert">{error}</p>}
 </div>;
}
