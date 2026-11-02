'use client';
import {useRef,useState} from 'react';
import type {AdminPaidSlot} from './admin-paid-slot-client';
import {isDefinitivePaidSlotWriteDenial} from './admin-paid-slot-client';
import {submitPaidSlotDecision,type PaidSlotDecisionInput,
 type PaidSlotDecision} from './admin-paid-slot-decision-client';
import css from './AdminAcademyMvp.module.css';

type Phase='idle'|'busy'|'uncertain'|'denied'|'saved';

/** Synchronous write latch: React state may not rerender between two taps.
 * A retry is permitted only after an unknown outcome and reuses the same input. */
export function createPaidSlotDecisionGate(){
 let phase:'idle'|'busy'|'uncertain'|'closed'='idle';
 return {
  begin(retry=false):boolean{
   if(phase!==(retry?'uncertain':'idle'))return false;
   phase='busy';return true;
  },
  finish(uncertain:boolean):void{
   if(phase==='busy')phase=uncertain?'uncertain':'closed';
  }
 };
}
/** Scoped to one pending request and one signed staff session by parent key. */
export function AdminPaidSlotDecision({request,onCommitted}:{
 request:AdminPaidSlot;onCommitted:()=>void;
}){
 const [chosenDecision,setChosenDecision]=useState<PaidSlotDecision>('approved');
 const expired=request.state==='expired';
 // An expired proposal is never approvable; rejection remains auditable.
 const decision:PaidSlotDecision=expired?'rejected':chosenDecision;
 const [reason,setReason]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [phase,setPhase]=useState<Phase>('idle');
 const [pending,setPending]=useState<PaidSlotDecisionInput|null>(null);
 const [message,setMessage]=useState('');
 const gate=useRef(createPaidSlotDecisionGate());
 async function send(input:PaidSlotDecisionInput,retry=false){
  // Lock before the first await, not after a React render. Prevent two
  // different operationIds for one double-tapped approval.
  if(!gate.current.begin(retry))return;
  setPending(input);setPhase('busy');setMessage('');
  let ack;
  try{
   ack=await submitPaidSlotDecision(input);
  }catch(error){
   const known=isDefinitivePaidSlotWriteDenial(error);
   gate.current.finish(!known);
   setPhase(known?'denied':'uncertain');
   setMessage(known?
    'رفض الخادم القرار. حدّث السجل قبل اتخاذ إجراء جديد.':
    'نتيجة العملية غير مؤكدة. لا ترسل قرارًا جديدًا؛ أعد نفس العملية بمعرّفها الأصلي.');
   if(known)setPending(null);
   return;
  }
  gate.current.finish(false);
  setPending(null);setPhase('saved');
  setMessage(ack.lessonId?'أكد الخادم إنشاء الحصة وخصم وحدة واحدة.':
   'أكد الخادم رفض الطلب دون خصم رصيد.');
  onCommitted();
 }
 const locked=phase==='busy'||phase==='saved'||phase==='uncertain'||phase==='denied';
 return <form className={css.root} onSubmit={event=>{
  event.preventDefault();
  if(locked||!confirmed||reason.trim().length<8||reason.trim().length>500)return;
  const input:PaidSlotDecisionInput={
   operationId:crypto.randomUUID(),requestId:request.requestId,
   decision,reason:reason.trim()
  };
  void send(input);
 }}>
  <h3>قرار إداري مدقّق</h3>
  {expired?<p>انتهت صلاحية هذا الطلب. لا يمكن اعتماده أو خصم حصة؛
   يمكن تسجيل رفض إداري مدقّق فقط لإغلاق السجل.</p>:
   <p>الموافقة تنشئ حصة ٤٠ دقيقة وتخصم حصة واحدة فقط إذا اجتازت قيود D1.
   الرفض لا يخصم رصيدًا. راجع صلاحية الشيخ وتوفر الموعد والرصيد قبل التأكيد.</p>}
  <label>القرار
   <select value={decision} disabled={locked}
    onChange={e=>{setChosenDecision(e.target.value as PaidSlotDecision);setConfirmed(false);}}>
    {!expired&&<option value="approved">اعتماد الموعد وخصم حصة</option>}
    <option value="rejected">رفض الطلب دون خصم</option>
   </select>
  </label>
  <label>سبب القرار (٨–٥٠٠ حرف)
   <input required minLength={8} maxLength={500} value={reason} disabled={locked}
    onChange={e=>{setReason(e.target.value);setConfirmed(false);}}/>
  </label>
  <label><input type="checkbox" checked={confirmed} disabled={locked}
   onChange={e=>setConfirmed(e.target.checked)}/>
   {expired?'أؤكد رفض الطلب المنتهي دون خصم رصيد.':
    'راجعت الطلب والشيخ والرصيد وأؤكد تسجيل القرار.'}</label>
  <button type="submit" disabled={locked||!confirmed||
   reason.trim().length<8||reason.trim().length>500}>
   {phase==='busy'?'جارٍ تسجيل القرار…':
    decision==='approved'?'اعتماد الحصة':'رفض الطلب'}
  </button>
  {message&&<p role="status">{message}</p>}
  {phase==='uncertain'&&pending&&<button type="button"
   onClick={()=>void send(pending,true)}>إعادة نفس العملية فقط</button>}
 </form>;
}
