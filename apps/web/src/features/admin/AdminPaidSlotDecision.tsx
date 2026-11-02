'use client';
import {useState} from 'react';
import type {AdminPaidSlot} from './admin-paid-slot-client';
import {AdminPaidSlotError} from './admin-paid-slot-client';
import {submitPaidSlotDecision,type PaidSlotDecisionInput,
 type PaidSlotDecision} from './admin-paid-slot-decision-client';
import css from './AdminAcademyMvp.module.css';

type Phase='idle'|'busy'|'uncertain'|'denied'|'saved';
/** Scoped to one pending request and one signed staff session by parent key. */
export function AdminPaidSlotDecision({request,onCommitted}:{
 request:AdminPaidSlot;onCommitted:()=>void;
}){
 const [decision,setDecision]=useState<PaidSlotDecision>('approved');
 const [reason,setReason]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [phase,setPhase]=useState<Phase>('idle');
 const [pending,setPending]=useState<PaidSlotDecisionInput|null>(null);
 const [message,setMessage]=useState('');
 async function send(input:PaidSlotDecisionInput){
  setPhase('busy');setMessage('');
  try{
   const ack=await submitPaidSlotDecision(input);
   setPending(null);setPhase('saved');
   setMessage(ack.lessonId?'أكد الخادم إنشاء الحصة وخصم وحدة واحدة.':
    'أكد الخادم رفض الطلب دون خصم رصيد.');
   onCommitted();
  }catch(error){
   const known=error instanceof AdminPaidSlotError&&
    error.status>=400&&error.status<500;
   setPhase(known?'denied':'uncertain');
   setMessage(known?
    'رفض الخادم القرار. حدّث السجل قبل اتخاذ إجراء جديد.':
    'نتيجة العملية غير مؤكدة. لا ترسل قرارًا جديدًا؛ أعد نفس العملية بمعرّفها الأصلي.');
   if(known)setPending(null);
  }
 }
 const locked=phase==='busy'||phase==='saved'||phase==='uncertain'||phase==='denied';
 return <form className={css.root} onSubmit={event=>{
  event.preventDefault();
  if(locked||!confirmed||reason.trim().length<8||reason.trim().length>500)return;
  const input:PaidSlotDecisionInput={
   operationId:crypto.randomUUID(),requestId:request.requestId,
   decision,reason:reason.trim()
  };
  setPending(input);
  void send(input);
 }}>
  <h3>قرار إداري مدقّق</h3>
  <p>الموافقة تنشئ حصة ٤٠ دقيقة وتخصم حصة واحدة فقط إذا اجتازت قيود D1.
   الرفض لا يخصم رصيدًا. راجع صلاحية الشيخ وتوفر الموعد والرصيد قبل التأكيد.</p>
  <label>القرار
   <select value={decision} disabled={locked}
    onChange={e=>{setDecision(e.target.value as PaidSlotDecision);setConfirmed(false);}}>
    <option value="approved">اعتماد الموعد وخصم حصة</option>
    <option value="rejected">رفض الطلب دون خصم</option>
   </select>
  </label>
  <label>سبب القرار (٨–٥٠٠ حرف)
   <input required minLength={8} maxLength={500} value={reason} disabled={locked}
    onChange={e=>{setReason(e.target.value);setConfirmed(false);}}/>
  </label>
  <label><input type="checkbox" checked={confirmed} disabled={locked}
   onChange={e=>setConfirmed(e.target.checked)}/>
   راجعت الطلب والشيخ والرصيد وأؤكد تسجيل القرار.</label>
  <button type="submit" disabled={locked||!confirmed||
   reason.trim().length<8||reason.trim().length>500}>
   {phase==='busy'?'جارٍ تسجيل القرار…':
    decision==='approved'?'اعتماد الحصة':'رفض الطلب'}
  </button>
  {message&&<p role="status">{message}</p>}
  {phase==='uncertain'&&pending&&<button type="button"
   onClick={()=>void send(pending)}>إعادة نفس العملية فقط</button>}
 </form>;
}
