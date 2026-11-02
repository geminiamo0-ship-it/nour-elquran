'use client';
import {useEffect,useRef,useState} from 'react';
import type {AccountSession} from '@/features/account';
import {fetchAdminTeachers,AdminTeachersError,type AdminTeacher}
 from './admin-teachers-client';
import {AdminPaidSlotError} from './admin-paid-slot-client';
import {fetchAdminPaidOffers,submitPaidOfferAction,
 type AdminPaidOffer,type PaidOfferAction} from './admin-paid-offers-client';
import css from './AdminAcademyMvp.module.css';

type Read=
 |{phase:'loading'}
 |{phase:'ready';session:AccountSession;offers:readonly AdminPaidOffer[];
   teachers:readonly AdminTeacher[];truncated:boolean}
 |{phase:'denied'|'error';session:AccountSession};
type Write={session:AccountSession;phase:'busy'|'uncertain'|'denied'|'saved'|'settled';
 message:string;pending:PaidOfferAction|null};
const cairo=new Intl.DateTimeFormat('ar-EG',{
 timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'
});
/** React's disabled state cannot prevent two submit handlers before rerender.
 * An unknown D1 outcome may only replay the original immutable operation. */
export function createPaidOfferWriteGate(){
 let phase:'idle'|'busy'|'uncertain'|'closed'='idle';
 return {
  begin(retry=false):boolean{
   if(phase!==(retry?'uncertain':'idle'))return false;
   phase='busy';return true;
  },
  finish(uncertain:boolean):void{
   if(phase==='busy')phase=uncertain?'uncertain':'closed';
  },
  reset():boolean{
   if(phase==='busy'||phase==='uncertain')return false;
   phase='idle';return true;
  }
 };
}
/** #317: Staff only, server-validated offers; publication never reserves a lesson. */
export function AdminPaidOffers({session}:{session:AccountSession}){
 const liveSession=useRef(session);liveSession.current=session;
 const writeGate=useRef(createPaidOfferWriteGate());
 // Invalidate pre-ACK reads immediately, before React runs effect cleanup.
 const readEpoch=useRef(0);
 const [read,setRead]=useState<Read>({phase:'loading'});
 const [retry,setRetry]=useState(0);
 const [write,setWrite]=useState<Write|null>(null);
 const [teacherId,setTeacherId]=useState('');
 const [localStart,setLocalStart]=useState('');
 const [publishConfirm,setPublishConfirm]=useState(false);
 const [withdrawId,setWithdrawId]=useState('');
 const [reason,setReason]=useState('');
 const [withdrawConfirm,setWithdrawConfirm]=useState(false);
 useEffect(()=>{
  const ctrl=new AbortController();
  const epoch=readEpoch.current;
  setRead({phase:'loading'});
  void Promise.all([
   fetchAdminPaidOffers(ctrl.signal),fetchAdminTeachers(ctrl.signal)
  ]).then(([offers,directory])=>{
   if(ctrl.signal.aborted||epoch!==readEpoch.current)return;
   setRead({phase:'ready',session,offers,
    teachers:directory.teachers,truncated:directory.truncated});
   // A confirmed write remains locked until this authoritative staff read.
   // An unknown write can never be cleared by a coincidental GET completion.
   if(writeGate.current.reset())setWrite(previous=>
    previous?.session===session&&previous.phase==='saved'?
     {...previous,phase:'settled'}:previous);
  }).catch(error=>{
   if(ctrl.signal.aborted||epoch!==readEpoch.current)return;
   const denied=(error instanceof AdminPaidSlotError||
    error instanceof AdminTeachersError)&&[401,403,404].includes(error.status);
   setRead({phase:denied?'denied':'error',session});
  });
  return()=>ctrl.abort();
 },[session,retry]);
 const current='session' in read&&read.session===session?read:null;
 const ready=current?.phase==='ready'?current:null;
 const phase=current?.phase??'loading';
 const result=write?.session===session?write:null;
 const locked=result?.phase==='busy'||result?.phase==='uncertain'||
  result?.phase==='denied'||result?.phase==='saved';
 const startMs=localStart?new Date(localStart).getTime():NaN;
 const future=Number.isSafeInteger(startMs)&&
  startMs>Date.now()+60000&&startMs+2400000<=Date.now()+30*86400000;
 const selectedTeacher=ready?.teachers.find(t=>t.id===teacherId&&
  t.status==='active'&&t.qualified);
 const withdrawOffer=ready?.offers.find(o=>o.offerId===withdrawId&&
  o.state==='published'&&o.startsAtMs>Date.now());
 async function send(action:PaidOfferAction,retry=false){
  if(liveSession.current!==session||!writeGate.current.begin(retry))return;
  setWrite({session,phase:'busy',message:'جارٍ انتظار تأكيد D1…',pending:action});
  try{
   await submitPaidOfferAction(action);
   writeGate.current.finish(false);
   if(liveSession.current!==session)return;
   setWrite({session,phase:'saved',pending:null,message:action.kind==='publish'?
    'أكد الخادم نشر الموعد. لم تُحجز حصة ولم يُخصم رصيد.':
    'أكد الخادم سحب العرض. لم يُلغَ أي حجز قائم.'});
   setPublishConfirm(false);setWithdrawConfirm(false);setReason('');
   setWithdrawId('');
   readEpoch.current+=1;setRead({phase:'loading'});setRetry(n=>n+1);
  }catch(error){
   const known=error instanceof AdminPaidSlotError&&
    error.status>=400&&error.status<500;
   writeGate.current.finish(!known);
   if(liveSession.current!==session)return;
   if(known&&error instanceof AdminPaidSlotError&&
    [401,403,404].includes(error.status))setRead({phase:'denied',session});
   setWrite({session,phase:known?'denied':'uncertain',
    pending:known?null:action,
    message:known?'رفض الخادم العملية؛ حدّث البيانات قبل أي إجراء جديد.':
     'نتيجة الكتابة غير مؤكدة. لا تنشئ عملية أخرى؛ أعد نفس العملية بمعرّفها الأصلي.'});
  }
 }
 return <section className={css.root} dir="rtl" aria-labelledby="paid-offers-heading">
  <h2 id="paid-offers-heading">نشر مواعيد الحصص المدفوعة</h2>
  <p>الإدارة تنشر موعد الشيخ أو تسحبه من السجل المدقّق. العرض ليس حجزًا،
   وطلب ولي الأمر لا يخصم رصيدًا. الموافقة على الحصة إجراء منفصل.</p>
  {phase==='loading'&&<p role="status">جارٍ التحقق من صلاحية الإدارة والمواعيد…</p>}
  {phase==='denied'&&<p role="alert">لا توجد صلاحية لقراءة المواعيد؛ لن نعرض بيانات قديمة.</p>}
  {phase==='error'&&<p role="alert">تعذّر قراءة المواعيد. لا توجد بيانات افتراضية.</p>}
  {(phase==='error'||phase==='denied'||ready)&&
   <button type="button" disabled={result?.phase==='busy'||
    result?.phase==='uncertain'} onClick={()=>{
     if(result?.phase==='denied'||result?.phase==='settled'){
      if(!writeGate.current.reset())return;
      setWrite(null);
     }
     // A confirmed write is still locked until a successful signed GET.
     readEpoch.current+=1;setRead({phase:'loading'});setRetry(n=>n+1);
    }}>
    تحديث المواعيد والصلاحيات
   </button>}
  {ready&&<>
   <p>أحدث ١٠٠ عرض خلال الفترة المحددة بحد أقصى؛ القائمة ليست أرشيفًا كاملًا.
    {ready.truncated?' دليل الشيوخ يعرض أول ٥٠ شيخًا فقط.':''}</p>
   <form onSubmit={e=>{
    e.preventDefault();
    if(locked||!selectedTeacher||!future||!publishConfirm)return;
    void send({kind:'publish',input:{
     operationId:crypto.randomUUID(),teacherId:selectedTeacher.id,startsAtMs:startMs
    }});
   }}>
    <h3>نشر موعد متاح</h3>
    <label>الشيخ المؤهل
     <select required value={teacherId} disabled={locked}
      onChange={e=>{setTeacherId(e.target.value);setPublishConfirm(false);}}>
      <option value="">اختر شيخًا من الدليل الموثق</option>
      {ready.teachers.filter(t=>t.status==='active'&&t.qualified).map(t=>
       <option key={t.id} value={t.id}>{t.name}</option>)}
     </select>
    </label>
    <label>بداية الموعد (حسب توقيت جهازك)
     <input required type="datetime-local" value={localStart} disabled={locked}
      onChange={e=>{setLocalStart(e.target.value);setPublishConfirm(false);}}/>
    </label>
    {Number.isSafeInteger(startMs)&&<p>الموعد بتوقيت القاهرة:
     {' '}{cairo.format(new Date(startMs))} — مدة الحصة ٤٠ دقيقة.</p>}
    <label><input type="checkbox" checked={publishConfirm} disabled={locked}
     onChange={e=>setPublishConfirm(e.target.checked)}/>
     راجعت توافر الشيخ وأؤكد نشر هذا الموعد للطلاب المؤهلين.</label>
    <button type="submit" disabled={locked||!selectedTeacher||!future||!publishConfirm}>
     نشر الموعد</button>
   </form>
   <h3>العروض المنشورة والمسحوبة</h3>
   {ready.offers.length===0?<p>لا توجد مواعيد منشورة في النطاق الحالي.</p>:
    <div className={css.options} role="list" aria-label="مواعيد الحصص المدفوعة">
     {ready.offers.map(offer=><article role="listitem" key={offer.offerId}>
      <strong>{offer.teacherName}</strong> · {cairo.format(new Date(offer.startsAtMs))}
      {' · '}{offer.state==='published'?'منشور':'مسحوب'}
      <small> · معرّف العرض: <code dir="ltr">{offer.offerId}</code></small>
     </article>)}
    </div>}
   <form onSubmit={e=>{
    e.preventDefault();
    if(locked||!withdrawOffer||!withdrawConfirm||
     reason.trim().length<8||reason.trim().length>500)return;
    void send({kind:'withdraw',input:{operationId:crypto.randomUUID(),
     offerId:withdrawOffer.offerId,reason:reason.trim()}});
   }}>
    <h3>سحب عرض غير محجوز</h3>
    <p>السحب يمنع طلبات جديدة من العرض؛ لا يلغي حصة معتمدة أو يعيد رصيدًا.</p>
    <label>الموعد المنشور
     <select value={withdrawId} disabled={locked}
      onChange={e=>{setWithdrawId(e.target.value);setWithdrawConfirm(false);}}>
      <option value="">اختر عرضًا منشورًا</option>
      {ready.offers.filter(o=>o.state==='published'&&
       o.startsAtMs>Date.now()).map(o=>
       <option key={o.offerId} value={o.offerId}>
        {o.teacherName} — {cairo.format(new Date(o.startsAtMs))}
       </option>)}
     </select>
    </label>
    <label>سبب السحب (٨–٥٠٠ حرف)
     <input required minLength={8} maxLength={500} value={reason}
      disabled={locked} onChange={e=>{setReason(e.target.value);
       setWithdrawConfirm(false);}}/>
    </label>
    <label><input type="checkbox" checked={withdrawConfirm} disabled={locked}
     onChange={e=>setWithdrawConfirm(e.target.checked)}/>
     أؤكد سحب العرض المحدد مع تسجيل السبب في D1.</label>
    <button type="submit" disabled={locked||!withdrawOffer||!withdrawConfirm||
     reason.trim().length<8||reason.trim().length>500}>سحب العرض</button>
   </form>
  </>}
  {result&&<p role={result.phase==='denied'?'alert':'status'}>{result.message}</p>}
  {result?.phase==='uncertain'&&result.pending&&
   <button type="button" onClick={()=>void send(result.pending!,true)}>
    إعادة نفس العملية فقط
   </button>}
 </section>;
}
