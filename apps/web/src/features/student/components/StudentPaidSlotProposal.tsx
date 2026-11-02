'use client';
import {useEffect,useRef,useState} from 'react';
import {fetchPaidSlotOffers,type PaidSlotOffer} from '../paid-slot-offers-client';
import {PaidSlotRequestsError,submitPaidSlotProposal,
 type PaidSlotProposalInput} from '../paid-slot-requests-client';
import {currentLearnerRead,type LearnerScoped} from './learner-scope';
import styles from '../StudentPortal.module.css';

type Attempt=Readonly<{learnerId:string;offerId:string;input:PaidSlotProposalInput}>;
type Phase='idle'|'sending'|'uncertain'|'accepted'|'denied';
/** A confirmed proposal can be refreshed to observe a later staff decision.
 * An uncertain POST must only be replayed with its original operationId. */
export const canRefreshPaidSlotProposal=(phase:Phase)=>
 phase!=='sending'&&phase!=='uncertain';
/** A proxy timeout, early retry or rate limit is not proof that D1 did not
 * commit. Keep the original immutable operationId for explicit replay. */
export const isUncertainPaidSlotProposalOutcome=(error:unknown):boolean=>
 !(error instanceof PaidSlotRequestsError)||
 [408,425,429].includes(error.status)||error.status>=500||
 error.code==='NETWORK_OUTCOME_UNKNOWN'||
 error.code==='INVALID_PAID_SLOT_PROPOSAL_ACK';
/** A React state update is not a synchronous lock: two rapid taps can run
 * before rerender. Only one operationId may be in flight, and an uncertain
 * outcome may replay that same operation after the first call settles. */
export function createPaidSlotProposalGate(){
 let state:'idle'|'busy'|'uncertain'|'closed'='idle';
 return {
  begin(retry=false):boolean{
   if(state!==(retry?'uncertain':'idle'))return false;
   state='busy';return true;
  },
  finish(uncertain:boolean):void{
   if(state==='busy')state=uncertain?'uncertain':'closed';
  },
  reset():boolean{
   // Neither a pending write nor an unknown outcome can be discarded.
   if(state==='busy'||state==='uncertain')return false;
   state='idle';return true;
  }
 };
}
/** An old GET can resolve after refresh was clicked but before React runs
 * effect cleanup. The epoch also rejects a stale submit handler in the
 * pre-rerender gap, when its old confirmed offer is still in closure state. */
export function createPaidSlotOfferReadEpoch(){
 let epoch=0;
 return {
  current:()=>epoch,
  invalidate:()=>++epoch,
  isCurrent:(observed:number)=>observed===epoch
 };
}
/** Refresh is a new authoritative read: clear old selection and confirmation
 * on the same render, before the next useEffect starts its D1 fetch. */
export const resetPaidSlotProposalRefresh=(learnerId:string)=>({
 read:{learnerId,status:'loading' as const,rows:[] as readonly PaidSlotOffer[]},
 selectedId:'',confirmed:false,attempt:null,phase:'idle' as const
});
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
 const gate=useRef(createPaidSlotProposalGate());
 const readEpoch=useRef(createPaidSlotOfferReadEpoch());
 const renderedReadEpoch=readEpoch.current.current();
 activeLearner.current=learnerId;
 useEffect(()=>{
  alive.current=true;
  return()=>{alive.current=false;};
 },[]);
 useEffect(()=>{
  const abort=new AbortController();
  const epoch=readEpoch.current.current();
  setRead({learnerId,status:'loading',rows:[]});
  setSelectedId('');setConfirmed(false);
  void fetchPaidSlotOffers(learnerId,abort.signal).then(offers=>{
   if(!abort.signal.aborted&&readEpoch.current.isCurrent(epoch))
    setRead({learnerId,status:'ready',rows:offers});
  }).catch(()=>{
   if(!abort.signal.aborted&&readEpoch.current.isCurrent(epoch))
    setRead({learnerId,status:'error',rows:[]});
  });
  return()=>abort.abort();
 },[learnerId,revision]);
 const visible=currentLearnerRead(read,learnerId);
 const selected=visible.status==='ready'?
  visible.rows.find(offer=>offer.offerId===selectedId):undefined;
 const activeAttempt=attempt?.learnerId===learnerId?attempt:null;
 const locked=phase==='sending'||phase==='uncertain'||phase==='accepted';
 async function send(next:Attempt,retry=false){
  // Begin synchronously, before changing the retained attempt or awaiting
  // fetch. A second rapid tap must never replace the original operationId.
  if(activeLearner.current!==next.learnerId||!gate.current.begin(retry))return;
  setAttempt(next);setPhase('sending');
  try{
   await submitPaidSlotProposal(next.learnerId,next.input);
  }catch(error){
   // The server may have persisted a request before the response was lost.
   // Keep the exact immutable operationId/payload for explicit replay only.
   const unknown=isUncertainPaidSlotProposalOutcome(error);
   gate.current.finish(unknown);
   if(!alive.current||activeLearner.current!==next.learnerId)return;
   setPhase(unknown?'uncertain':'denied');
   return;
  }
  gate.current.finish(false);
  if(!alive.current||activeLearner.current!==next.learnerId)return;
  setPhase('accepted');
  // A parent refresh callback is not part of the D1 write/ACK. If it fails,
  // the already confirmed proposal must never become 'uncertain'.
  onSubmitted();
 }
 function submit(){
  if(!readEpoch.current.isCurrent(renderedReadEpoch)||
   locked||!confirmed||!selected||activeAttempt)return;
  const input=proposalFromPublishedOffer(visible.rows,selected.offerId,
   crypto.randomUUID());
  if(!input)return;
  const next={learnerId,offerId:selected.offerId,input};
  void send(next);
 }
 function refresh(){
  if(!readEpoch.current.isCurrent(renderedReadEpoch)||
   !canRefreshPaidSlotProposal(phase)||!gate.current.reset())return;
  // Invalidate any pre-refresh GET or stale click before React rerenders.
  readEpoch.current.invalidate();
  const reset=resetPaidSlotProposalRefresh(learnerId);
  setRead(reset.read);setSelectedId(reset.selectedId);
  setConfirmed(reset.confirmed);setAttempt(reset.attempt);
  setPhase(reset.phase);setRevision(v=>v+1);
 }
 return <section className={styles.panel} dir="rtl" aria-label="طلب موعد حصة مدفوعة">
  <div className={styles.panelHead}><div>
   <p className={styles.eyebrow}>مواعيد منشورة من الإدارة</p>
   <h2>طلب موعد حصة مدفوعة</h2>
  </div><button type="button" className={styles.outlineButton}
   disabled={!canRefreshPaidSlotProposal(phase)} onClick={refresh}>تحديث المواعيد</button></div>
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
   تم تسجيل طلب الموعد لدى الإدارة. انتظر قرار الاعتماد؛ لم يُحجز موعد بعد. يمكنك تحديث المواعيد لاحقًا بعد قرار الإدارة.</p>}
  {phase==='denied'&&<p role="alert">
   رفض الخادم هذا الطلب أو انتهت صلاحيته. حدّث المواعيد قبل تقديم طلب جديد.</p>}
  {phase==='uncertain'&&activeAttempt&&<div role="alert">
   <p>نتيجة إرسال الطلب غير مؤكدة. لا تختَر موعدًا جديدًا؛
    أعد إرسال نفس العملية فقط للتحقق من نتيجتها دون إنشاء طلب مكرر.</p>
   <button type="button" className={styles.outlineButton}
    onClick={()=>void send(activeAttempt,true)}>التحقق بإعادة نفس الطلب</button>
  </div>}
  <small>المواعيد والرصيد يتغيران؛ ظهور الموعد لا يضمن اعتماده.
   لا توجد عملية دفع أو استرداد تلقائي في هذه الصفحة.</small>
 </section>;
}
