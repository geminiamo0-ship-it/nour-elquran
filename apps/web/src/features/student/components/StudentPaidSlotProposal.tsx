'use client';
import {useEffect,useRef,useState} from 'react';
import {fetchPaidSlotOffers,type PaidSlotOffer} from '../paid-slot-offers-client';
import {PaidSlotRequestsError,submitPaidSlotProposal,
 type PaidSlotProposalInput} from '../paid-slot-requests-client';
import {currentLearnerRead,type LearnerScoped} from './learner-scope';
import styles from '../StudentPortal.module.css';

type Attempt=Readonly<{learnerId:string;offerId:string;input:PaidSlotProposalInput}>;
type Phase='idle'|'sending'|'uncertain'|'accepted'|'denied';
const date=new Intl.DateTimeFormat('ar-EG',{
 timeZone:'Africa/Cairo',dateStyle:'full',timeStyle:'short'
});

/** Never construct a proposal from free-text teacher, time or cycle values. */
export function proposalFromPublishedOffer(offers:readonly PaidSlotOffer[],
 offerId:string,operationId:string):PaidSlotProposalInput|null{
 const offer=offers.find(item=>item.offerId===offerId);
 return offer?{operationId,teacherId:offer.teacherId,cycleId:offer.cycleId,
  startsAtMs:offer.startsAtMs}:null;
}

export function StudentPaidSlotProposal({learnerId,onSubmitted}:{
 learnerId:string;onSubmitted:()=>void;
}){
 const [read,setRead]=useState<LearnerScoped<PaidSlotOffer>>({
  learnerId,status:'loading',rows:[]
 });
 const [revision,setRevision]=useState(0);
 const [selectedId,setSelectedId]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [attempt,setAttempt]=useState<Attempt|null>(null);
 const [phase,setPhase]=useState<Phase>('idle');
 const activeLearner=useRef(learnerId);
 const alive=useRef(true);
 activeLearner.current=learnerId;
 useEffect(()=>{
  alive.current=true;
  return()=>{alive.current=false;};
 },[]);
 useEffect(()=>{
  const abort=new AbortController();
  setRead({learnerId,status:'loading',rows:[]});
  setSelectedId('');setConfirmed(false);
  void fetchPaidSlotOffers(learnerId,abort.signal).then(offers=>{
   if(!abort.signal.aborted)setRead({learnerId,status:'ready',rows:offers});
  }).catch(()=>{
   if(!abort.signal.aborted)setRead({learnerId,status:'error',rows:[]});
  });
  return()=>abort.abort();
 },[learnerId,revision]);
 const visible=currentLearnerRead(read,learnerId);
 const selected=visible.status==='ready'?
  visible.rows.find(offer=>offer.offerId===selectedId):undefined;
 const activeAttempt=attempt?.learnerId===learnerId?attempt:null;
 const locked=phase==='sending'||phase==='uncertain'||phase==='accepted';
 async function send(next:Attempt){
  if(phase==='sending'||activeLearner.current!==next.learnerId)return;
  setPhase('sending');
  try{
   await submitPaidSlotProposal(next.learnerId,next.input);
   if(!alive.current||activeLearner.current!==next.learnerId)return;
   setPhase('accepted');
   onSubmitted();
  }catch(error){
   if(!alive.current||activeLearner.current!==next.learnerId)return;
   // The server may have persisted a request before the response was lost.
   // Keep the exact immutable operationId/payload for explicit replay only.
   const unknown=!(error instanceof PaidSlotRequestsError)||
    error.status>=500||error.code==='NETWORK_OUTCOME_UNKNOWN'||
    error.code==='INVALID_PAID_SLOT_PROPOSAL_ACK';
   setPhase(unknown?'uncertain':'denied');
  }
 }
 function submit(){
  if(locked||!confirmed||!selected||activeAttempt)return;
  const input=proposalFromPublishedOffer(visible.rows,selected.offerId,
   crypto.randomUUID());
  if(!input)return;
  const next={learnerId,offerId:selected.offerId,input};
  setAttempt(next);
  void send(next);
 }
 function refresh(){
  if(locked)return;
  setAttempt(null);setPhase('idle');setRevision(v=>v+1);
 }
 return <section className={styles.panel} dir="rtl" aria-label="طلب موعد حصة مدفوعة">
  <div className={styles.panelHead}><div>
   <p className={styles.eyebrow}>مواعيد منشورة من الإدارة</p>
   <h2>طلب موعد حصة مدفوعة</h2>
  </div><button type="button" className={styles.outlineButton}
   disabled={locked} onClick={refresh}>تحديث المواعيد</button></div>
  <p>اختر موعدًا متاحًا لهذا الطالب من الخادم. إرسال الطلب لا يحجز الحصة
   ولا يخصم من الباقة؛ القرار النهائي للإدارة بعد إعادة فحص الرصيد والجدول.</p>
  {visible.status==='loading'?<p role="status">جارٍ قراءة المواعيد المدفوعة المعتمدة…</p>:
   visible.status==='error'?<p role="alert">تعذّر التحقق من المواعيد.
    لن نعرض مواعيد غير موثقة أو نرسل طلبًا.</p>:
   visible.rows.length===0?<p className={styles.emptyBox}>
    لا توجد مواعيد مدفوعة منشورة ومتاحة لهذا الطالب حاليًا.</p>:
   <div className={styles.stack} role="group" aria-label="المواعيد المتاحة">
    {visible.rows.map(offer=><label key={offer.offerId}
     className={styles.lessonRow}>
     <span className={styles.lessonInfo}>
      <strong>{date.format(new Date(offer.startsAtMs))}</strong>
      <span>30 دقيقة تعليم · 40 دقيقة محجوزة في الجدول</span>
     </span>
     <input type="radio" name={'paid-slot-'+learnerId}
      value={offer.offerId} checked={selectedId===offer.offerId}
      disabled={locked||phase==='denied'}
      onChange={()=>{setSelectedId(offer.offerId);setConfirmed(false);}}/>
    </label>)}
   </div>}
  {selected&&phase==='idle'&&<label className={styles.lessonRow}>
   <span>أؤكد طلب هذا الموعد للطالب المحدد، وأفهم أنه ليس حجزًا مؤكدًا.</span>
   <input type="checkbox" checked={confirmed}
    onChange={event=>setConfirmed(event.currentTarget.checked)}/>
  </label>}
  {phase==='idle'&&<button type="button" className={styles.actionButton}
   disabled={!selected||!confirmed} onClick={submit}>إرسال طلب الموعد للإدارة</button>}
  {phase==='sending'&&<p role="status">جارٍ إرسال الطلب، دون خصم أو حجز فوري…</p>}
  {phase==='accepted'&&<p role="status">
   تم تسجيل طلب الموعد لدى الإدارة. انتظر قرار الاعتماد؛ لم يُحجز موعد بعد.</p>}
  {phase==='denied'&&<p role="alert">
   رفض الخادم هذا الطلب أو انتهت صلاحيته. حدّث المواعيد قبل تقديم طلب جديد.</p>}
  {phase==='uncertain'&&activeAttempt&&<div role="alert">
   <p>نتيجة إرسال الطلب غير مؤكدة. لا تختَر موعدًا جديدًا؛
    أعد إرسال نفس العملية فقط للتحقق من نتيجتها دون إنشاء طلب مكرر.</p>
   <button type="button" className={styles.outlineButton}
    onClick={()=>void send(activeAttempt)}>التحقق بإعادة نفس الطلب</button>
  </div>}
  <small>المواعيد والرصيد يتغيران؛ ظهور الموعد لا يضمن اعتماده.
   لا توجد عملية دفع أو استرداد تلقائي في هذه الصفحة.</small>
 </section>;
}
