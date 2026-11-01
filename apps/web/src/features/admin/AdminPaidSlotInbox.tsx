'use client';
import {useEffect,useState} from 'react';
import type {AccountSession} from '@/features/account';
import {AdminPaidSlotError,fetchAdminPaidSlots,type AdminPaidSlot}
 from './admin-paid-slot-client';
import css from './AdminPortal.module.css';
import {AdminPaidSlotDecision} from './AdminPaidSlotDecision';

type Read=
 |{phase:'loading'}
 |{phase:'ready';session:AccountSession;rows:readonly AdminPaidSlot[]}
 |{phase:'denied'|'error';session:AccountSession};
const date=new Intl.DateTimeFormat('ar-EG',{
 timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'
});
const states={pending:'بانتظار قرار الإدارة',
 approved:'تم اعتماد الحصة',rejected:'رُفض الطلب'} as const;

/** Signed staff inbox; only immutable pending requests offer audited decisions. */
export function AdminPaidSlotInbox({session}:{session:AccountSession}){
 const [read,setRead]=useState<Read>({phase:'loading'});
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setRead({phase:'loading'});
  void fetchAdminPaidSlots(controller.signal).then(rows=>{
   if(!controller.signal.aborted)setRead({phase:'ready',session,rows});
  }).catch(error=>{
   if(controller.signal.aborted)return;
   setRead({phase:error instanceof AdminPaidSlotError&&
    [401,403,404].includes(error.status)?'denied':'error',session});
  });
  return()=>controller.abort();
 },[session,retry]);
 // A changed account/session must never see an old staff snapshot before cleanup.
 const current='session' in read&&read.session===session?read:null;
 const ready=current?.phase==='ready'?current.rows:null;
 const phase=current?.phase??'loading';
 return <section className={css.collection} aria-labelledby="admin-paid-slot-heading" dir="rtl">
  <header className={css.collectionHero}>
   <p className={css.kicker}>سجل D1 · طلبات المواعيد المدفوعة</p>
   <h2 id="admin-paid-slot-heading">طلبات مواعيد الحصص المدفوعة</h2>
   <p>هذه الطلبات مقدّمة من حسابات أولياء الأمور. الطلب وحده لا ينشئ
    حصة ولا يخصم رصيدًا؛ اعتماد الإدارة هو الخطوة المنفصلة المسؤولة عن ذلك.</p>
  </header>
  <div className={css.collectionToolbar}>
   <p className={css.collectionDisclaimer}>
    تعرض القائمة أحدث ١٠٠ طلب بحد أقصى؛ قد توجد طلبات أقدم غير معروضة.
    اعتماد الطلبات يتطلب صلاحية إدارة فعلية، وإقرارًا صريحًا، وتأكيد D1.
   </p>
   <button type="button" className={css.staffRefresh}
    disabled={phase==='loading'} onClick={()=>setRetry(n=>n+1)}>
    تحديث الطلبات
   </button>
  </div>
  {phase==='loading'&&<p role="status" className={css.staffEmpty}>
   جارٍ التحقق من صلاحيات الإدارة وقراءة الطلبات…</p>}
  {phase==='denied'&&<p role="alert" className={css.staffError}>
   ليس لهذا الحساب صلاحية قراءة طلبات المواعيد. لا تُعرض سجلات سابقة.</p>}
  {phase==='error'&&<div role="alert" className={css.staffError}>
   <p>تعذّر التحقق من الطلبات الآن؛ لن نعرض بيانات افتراضية أو نفترض عدم وجود طلبات.</p>
   <button type="button" onClick={()=>setRetry(n=>n+1)}>إعادة المحاولة</button>
  </div>}
  {ready&&(
   ready.length===0?<p role="status" className={css.staffEmpty}>
    لا توجد طلبات مواعيد مدفوعة في السجل الحالي.</p>:
   <div className={css.collectionCards} role="list" aria-label="طلبات المواعيد المدفوعة">
    {ready.map(item=><article key={item.requestId} role="listitem"
     className={css.collectionCard}>
     <div className={css.collectionField}>
      <span>الطالب</span><strong>{item.learnerName.trim()}</strong>
     </div>
     <div className={css.collectionField}>
      <span>الشيخ</span><strong>{item.teacherName.trim()}</strong>
     </div>
     <div className={css.collectionField}>
      <span>الموعد بتوقيت القاهرة</span>
      <strong>{date.format(new Date(item.startsAtMs))}</strong>
     </div>
     <div className={css.collectionField}>
      <span>حالة الطلب</span><strong>{states[item.state]}</strong>
     </div>
     <div className={css.collectionField}>
      <span>معرّف الطلب للتدقيق</span>
      <code dir="ltr">{item.requestId}</code>
     </div>
     {item.state==='pending'&&<AdminPaidSlotDecision
      key={item.requestId+session.user.id} request={item}
      onCommitted={()=>setRetry(n=>n+1)}/>}
    </article>)}
   </div>
  )}
 </section>;
}
