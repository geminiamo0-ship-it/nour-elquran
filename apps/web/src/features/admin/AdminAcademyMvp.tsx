'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {AccountSession} from '@/features/account';
import styles from './AdminAcademyMvp.module.css';
import {academyPendingStore,type AcademyPendingCommand} from './admin-academy-pending';
import {academyAdminOutcomeIsUncertain,academyAdminAckIsVerified,
 academyAdminCanReject,academyAdminAckClearsRequestSelection,
 academyAdminConfirmationMatchesMode,academyAdminSessionLockIsBusy,
 academyAdminReleaseSessionLock,academyAdminCanReplay,type AcademySessionAttempt} from './admin-academy-write-outcome';
import {academyAdminReadHttpStatusIsValid,academyAdminSessionViewIsReady,
 parseAdminAcademyRead,academyAdminNeedsOriginalQuoteOption,academyAdminInviteStatusLabel,academyAdminInviteDisplayName,
 academyAdminNextInviteExpiryDelay,academyAdminReadEpochMayApply,academyAdminStaffAccessRevoked,
 academyAdminMutationMayApply,
 type AdminAcademySnapshot} from './admin-academy-read';

type Academy=AdminAcademySnapshot;
type Result={phase:'idle'|'busy'|'done'|'error'|'uncertain';message:string};
type Mode='packages'|'requests'|'invites'|'contact';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const iso=()=>crypto.randomUUID();
const date=new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',dateStyle:'medium'});
function label(v:number){return v.toLocaleString('ar-EG');}
export async function readAcademy(signal:AbortSignal):Promise<Academy>{
 const res=await fetch('/v1/staff/academy',{credentials:'same-origin',cache:'no-store',
  redirect:'error',signal});
 // An unexpected 2xx (e.g. 202/206) is not a complete authorized D1 snapshot.
 if(res.status===401||res.status===403)
  throw new AcademyCommandError('STAFF_ACCESS_DENIED',res.status,true);
 if(!academyAdminReadHttpStatusIsValid(res.status))
  throw new Error('تعذّر قراءة الإدارة من الخادم');
 // A malformed 200 JSON body can include private D1/proxy text in the
 // browser SyntaxError. Never surface that text to a privileged UI.
 try{
  const v:unknown=await res.json();
  return parseAdminAcademyRead(v);
 }catch{
  throw new Error('تعذّر قراءة الإدارة من الخادم');
 }
}
const operationErrors:Record<string,string>={
 ACADEMY_REQUEST_ALREADY_ACTIVATED:'الطلب اتفعّل بالفعل. اضغط تحديث وشوف الاشتراك في ملف الطالب.',
 ACADEMY_REQUEST_NOT_FOUND:'طلب الاشتراك غير موجود. حدّث قائمة الطلبات.',
 ACADEMY_REQUEST_REJECTED:'الطلب مرفوض ولا يمكن تفعيله. راجع الطلب قبل المحاولة.',
 ACADEMY_INVITE_ALREADY_ISSUED:'تم إصدار الدعوة السابقة بالفعل، ورابطها السري لا يمكن استعادته. حدّث سجل الدعوات وتحقق من الحالة قبل إنشاء رابط جديد.',
 ACADEMY_REQUEST_MISMATCH:'الطلب لا يطابق الطالب أو سعر الباقة المختار. اختر الطلب الأصلي من القائمة.',
 ACADEMY_PACKAGE_VERSION_UNAVAILABLE:'الباقة دي اتغيّرت أو اتوقفت. حدّث الباقات واختر الإصدار الصحيح.',
 ACADEMY_CYCLE_OVERLAP:'فيه اشتراك متداخل لنفس الطالب. راجع مدة الباقة الحالية قبل التجديد.',
 ACADEMY_RENEWAL_CONFLICT:'سلسلة تجديد الباقة تغيّرت. حدّث الملف وتحقق من الاشتراك الموجود.',
 ACADEMY_ROLLOVER_CONFLICT:'رصيد الترحيل تغيّر. حدّث بيانات الطالب ثم جرّب مرة واحدة.',
 ACADEMY_STAFF_ACCESS_CHANGED:'صلاحية الإدارة اتغيرت. سجّل الدخول بحساب إداري معتمد.',
 ACADEMY_LEARNER_UNAVAILABLE:'ملف الطالب غير نشط أو غير متاح. راجع ملف الطالب.',
 ACADEMY_REFERENCE_UNAVAILABLE:'الطالب أو إصدار الباقة غير موجود في قاعدة البيانات.',
 ACADEMY_ACTIVATION_DENIED:'تعذّر تنفيذ التفعيل بسبب قيد في سجل الاشتراكات. لا تكرر استلام الدفع؛ راجع الاشتراك الحالي أو بلّغ الإدارة.',
};
/** Never render arbitrary HTTP/D1 error codes: a proxy or malformed handler
 * could include private text or an unbounded payload in its code field. */
export function academyAdminOperationErrorMessage(code:string):string{
 const message=Object.prototype.hasOwnProperty.call(operationErrors,code)?
  operationErrors[code]:undefined;
 return message??'تعذّر تنفيذ العملية. راجع السجل وتحقق من حالتها قبل المحاولة مجددًا.';
}
class AcademyCommandError extends Error{
 constructor(readonly code:string,readonly status:number,
  readonly exactCodeOnly:boolean){super(code);}
}
/** A malformed 403 from an intermediary must hide privileged staff data,
 * but it cannot prove whether an earlier D1 mutation committed. Preserve the
 * original operation for explicit same-ID reconciliation after re-auth. */
export async function submitAcademyCommand(path:string,command:unknown){
 const res=await fetch('/v1/staff/academy/'+path,{method:'POST',
  credentials:'same-origin',cache:'no-store',redirect:'error',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(command)});
 if(res.status===401)
  throw new AcademyCommandError('STAFF_ACCESS_DENIED',401,false);
 let v:unknown;
 try{v=await res.json();}
 catch{
  if(res.status===403)
   throw new AcademyCommandError('STAFF_ACCESS_DENIED',403,false);
  throw new Error('استجابة غير صالحة');
 }
 if(!v||typeof v!=='object'||Array.isArray(v)||
  typeof (v as {code?:unknown}).code!=='string'){
  if(res.status===403)
   throw new AcademyCommandError('STAFF_ACCESS_DENIED',403,false);
  throw new Error('استجابة غير صالحة');
 }
 const code=(v as {code:string}).code;
 if(!res.ok)throw new AcademyCommandError(code,res.status,
  Object.keys(v).length===1);
 if(!academyAdminAckIsVerified(path,res.status,v,command))
  throw new Error('استجابة تأكيد غير موثوقة');
 return {code,...(v as object)};
}
/** Operations never optimistically claim a payment or an activation. */
export function AdminAcademyMvp({session,mode}:{session:AccountSession;mode:Mode}){
 const [data,setData]=useState<Academy|null>(null);
 const [dataSession,setDataSession]=useState<AccountSession|null>(null);
 const [readError,setReadError]=useState(false);
 const [inviteNow,setInviteNow]=useState(()=>Date.now());
 const [refresh,setRefresh]=useState(0);
 const [result,setResult]=useState<Result>({phase:'idle',message:''});
 const [title,setTitle]=useState('');
 const [price,setPrice]=useState('');
 const [sessions,setSessions]=useState('8');
 const [selectedPackage,setSelectedPackage]=useState('');
 const [packageFormOpen,setPackageFormOpen]=useState(false);
 const [selectedRequest,setSelectedRequest]=useState('');
 const [learnerId,setLearnerId]=useState('');
 const [reason,setReason]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [confirmedMode,setConfirmedMode]=useState<Mode|null>(null);
 const [whatsapp,setWhatsapp]=useState('');
 const [inviteUrl,setInviteUrl]=useState('');
 const [inviteSession,setInviteSession]=useState<AccountSession|null>(null);
 const [pendingOp,setPendingOp]=useState<AcademyPendingCommand|null>(null);
 const [pendingSession,setPendingSession]=useState<AccountSession|null>(null);
 const sending=useRef<AcademySessionAttempt<AccountSession>|null>(null);
 const currentSession=useRef(session);
 const readEpoch=useRef(0);
 const revokedStaff=useRef(false);
 currentSession.current=session;
 function invalidateStaffData(){
  ++readEpoch.current;
  revokedStaff.current=true;
  setData(null);setDataSession(null);setReadError(true);
  setInviteUrl('');setInviteSession(null);setWhatsapp('');setConfirmed(false);
 }
 // State survives one render across a prop switch, before effect cleanup runs.
 // Render only data, secret invite URLs and pending retries owned by this session.
 const visibleData=academyAdminSessionViewIsReady(dataSession,session)?data:null;
 const visibleInviteUrl=academyAdminSessionViewIsReady(inviteSession,session)?inviteUrl:'';
 const visiblePendingOp=academyAdminSessionViewIsReady(pendingSession,session)?pendingOp:null;
 // A one-use invitation can expire while the Admin page stays open.
 // Re-render at the Worker boundary rather than leaving a stale "pending" label.
 useEffect(()=>{
  if(mode!=='invites'||!visibleData)return;
  const delay=academyAdminNextInviteExpiryDelay(visibleData.invites,inviteNow);
  if(delay===null)return;
  const timer=window.setTimeout(()=>setInviteNow(Date.now()),delay);
  return()=>window.clearTimeout(timer);
 },[mode,visibleData,inviteNow]);
 // Background tabs may suspend timers. Recheck the displayed expiry as soon
 // as the staff returns, without requesting or caching any additional data.
 useEffect(()=>{
  const syncClock=()=>{
   if(document.visibilityState==='visible')setInviteNow(Date.now());
  };
  window.addEventListener('focus',syncClock);
  document.addEventListener('visibilitychange',syncClock);
  return()=>{
   window.removeEventListener('focus',syncClock);
   document.removeEventListener('visibilitychange',syncClock);
  };
 },[]);
 useEffect(()=>{
  const ctrl=new AbortController();
  const epoch=++readEpoch.current;
  setData(null);setDataSession(null);setReadError(false);
  setInviteUrl('');setInviteSession(null);
  // Reset private learner IDs, audit notes and previous staff form selections
  // before the next actor's authorized snapshot can become visible.
  setSelectedRequest('');setLearnerId('');setReason('');setConfirmed(false);
  setSelectedPackage('');setTitle('');setPrice('');setSessions('8');
  setPackageFormOpen(false);setWhatsapp('');
  const held=academyPendingStore.forActor(session.user.id);
  setPendingOp(held);setPendingSession(session);
  setResult(held?{phase:'uncertain',message:
   'نتيجة العملية السابقة غير مؤكدة؛ أعد نفس العملية فقط.'}:
   {phase:'idle',message:''});
  void readAcademy(ctrl.signal).then(v=>{
   if(academyAdminReadEpochMayApply(epoch,readEpoch.current,
    ctrl.signal.aborted,currentSession.current===session)){
    revokedStaff.current=false;
    setInviteNow(Date.now()); // A delayed signed GET must not reuse the mount-time clock.
    setData(v);setDataSession(session);
    setReadError(false);setWhatsapp(v.whatsappNumber??'');
   }
  }).catch(e=>{
   if(!academyAdminReadEpochMayApply(epoch,readEpoch.current,
    ctrl.signal.aborted,currentSession.current===session))return;
   if(e instanceof AcademyCommandError&&
    academyAdminStaffAccessRevoked(e.status,e.code))invalidateStaffData();
   else setReadError(true);
   if(!academyPendingStore.forActor(session.user.id))
    setResult({phase:'error',message:e instanceof Error?e.message:'تعذّر تحميل البيانات'});
  });
  return()=>ctrl.abort();
 },[session,refresh]);
 const busy=result.phase==='busy'||result.phase==='uncertain';
 const selectedQuote=visibleData?.requests.find(r=>r.id===selectedRequest);
 // A→B→A must not revive a previously checked financial confirmation.
 // A mode comparison alone would accept the old check when returning to A.
 useEffect(()=>{
  setConfirmed(false);setConfirmedMode(null);
 },[mode]);
 const confirmedForMode=academyAdminConfirmationMatchesMode(confirmed,confirmedMode,mode);
 function confirmForMode(value:boolean){
  setConfirmed(value);setConfirmedMode(value?mode:null);
 }
 async function send(path:string,payload:unknown){
  if(academyAdminSessionLockIsBusy(sending.current,session)||
   !visibleData||revokedStaff.current)return;
  const held=academyPendingStore.forActor(session.user.id);
  // An unresolved settlement must be retried with the exact original object.
  if(held&&(held.path!==path||held.payload!==payload))return;
  const operation=held??{actorId:session.user.id,path,payload};
  if(!academyPendingStore.hold(operation))return;
  const attempt={};
  // Prevent a second mounted panel racing an in-flight request.
  if(!academyPendingStore.beginAttempt(operation,attempt))return;
  sending.current={session,attempt};
  const startedSession=session;
  const stillCurrent=()=>academyAdminMutationMayApply(
   startedSession,currentSession.current,revokedStaff.current);
  setResult({phase:'busy',message:'جارٍ تسجيل العملية لدى الخادم…'});
  setPendingOp(operation);setPendingSession(session);
  try{
   const ack=await submitAcademyCommand(path,payload);
   // A late response must never expose a one-use invitation to a new actor.
   if(!stillCurrent())return;
   academyPendingStore.clearIfSame(operation);
   setPendingOp(null);setPendingSession(null);
   setResult({phase:'done',message:'سجّل الخادم العملية: '+ack.code});
   setConfirmed(false);setReason('');
   // A confirmed activation/rejection invalidates the selected D1 request.
   // Never leave it preselected for an accidental second financial command.
   // This executes only after a verified ACK, not for an uncertain outcome.
   if(academyAdminAckClearsRequestSelection(path)){
    setSelectedRequest('');setSelectedPackage('');setLearnerId('');
   }
   // A committed write invalidates every earlier GET, including invite writes.
   // Keep the one-use link only for this still-authorized staff session.
   const epoch=++readEpoch.current;
   setData(null);setDataSession(null);setReadError(false);
   if(path==='invites'&&typeof (ack as {token?:unknown}).token==='string'){
    const token=(ack as {code:string;token?:string}).token!;
    setInviteUrl(window.location.origin+'/teacher/join?token='+token);
    setInviteSession(startedSession);
   }
   const ctrl=new AbortController();
   void readAcademy(ctrl.signal).then(v=>{
    if(stillCurrent()&&academyAdminReadEpochMayApply(epoch,readEpoch.current,
     ctrl.signal.aborted,currentSession.current===startedSession)){
     setInviteNow(Date.now());
     setData(v);setDataSession(startedSession);setReadError(false);
     setWhatsapp(v.whatsappNumber??'');
    }
   }).catch(e=>{
    if(currentSession.current!==startedSession||
     epoch!==readEpoch.current||ctrl.signal.aborted)return;
    if(e instanceof AcademyCommandError&&
     academyAdminStaffAccessRevoked(e.status,e.code))invalidateStaffData();
    else setReadError(true);
    setResult({phase:'error',
     message:'تعذّر تحديث السجل. راجع العملية المحفوظة قبل متابعة الإدارة.'});
   });
  }catch(e){
   if(currentSession.current!==startedSession)return;
   if(e instanceof AcademyCommandError&&
    academyAdminStaffAccessRevoked(e.status,e.code))invalidateStaffData();
   const uncertain=!(e instanceof AcademyCommandError)||
    academyAdminOutcomeIsUncertain(path,e.status,e.code,e.exactCodeOnly);
   if(uncertain){
    setResult({phase:'uncertain',message:
     'نتيجة العملية غير مؤكدة. لا تنشئ عملية جديدة؛ أعد نفس الطلب بمعرّفه الأصلي.'});
   }else{
    academyPendingStore.clearIfSame(operation);
    setPendingOp(null);setPendingSession(null);
    setResult({phase:'error',message:e instanceof AcademyCommandError?
     academyAdminOperationErrorMessage(e.code):
     'تعذّر تنفيذ العملية'});
   }
  }finally{
   academyPendingStore.finishAttempt(attempt);
   sending.current=academyAdminReleaseSessionLock(sending.current,attempt);
  }
 }
 function guard(event:FormEvent,action:()=>void){
  event.preventDefault();if(!confirmedForMode||busy||!visibleData)return;action();
 }
 const modeTitle={packages:'الباقات والأسعار',requests:'طلبات الاشتراك وتفعيل الطلاب',
  invites:'إضافة شيخ بدعوة',contact:'واتساب الأكاديمية'}[mode];
 return <section dir="rtl" className={styles.root} aria-label={modeTitle}>
  <h2>{modeTitle}</h2>
  {mode==='packages'?<p>أضف باقة أو عدّل سعرها وعدد حصصها. التعديلات الجديدة لا تغيّر الاشتراكات السابقة.</p>:
   <p>تُراجع كل عملية من الإدارة؛ واتساب ليس إثبات دفع تلقائيًا.</p>}
  <button type="button" onClick={()=>{
   ++readEpoch.current;setData(null);setDataSession(null);
   setRefresh(n=>n+1);
  }} disabled={result.phase==='busy'}>
   تحديث البيانات</button>
  {!visibleData&&<p role={readError?'alert':'status'}>{readError?
   'تعذّر تحميل بيانات الإدارة. اضغط تحديث البيانات للمحاولة مجددًا.':
   'جارٍ تحميل البيانات المصرح بها…'}</p>}
  {visibleData&&mode==='packages'&&<>
   <div className={styles.packageHeading}><h3>الباقات الحالية</h3>
    <button type="button" onClick={()=>{
     setSelectedPackage('');setTitle('');setPrice('');setSessions('8');
     setConfirmed(false);setPackageFormOpen(true);
    }}>+ إضافة باقة</button></div>
   {visibleData.packages.length===0?<p>لا توجد باقات مضافة بعد.</p>:
    <div className={styles.options}>
     {visibleData.packages.map(p=><article key={p.id}>
      <div className={styles.packageFacts}><strong>{p.title}</strong>
       <span>{label(p.priceEgp)} جنيه / {label(p.sessions)} حصص</span>
       <small>{p.active===1?'متاحة':'موقوفة'}</small></div>
      <button type="button" onClick={()=>{
       setSelectedPackage(p.packageId);setTitle(p.title);setPrice(String(p.priceEgp));
       setSessions(String(p.sessions));setConfirmed(false);setPackageFormOpen(true);
      }}>تعديل الإصدار القادم</button>
     </article>)}
    </div>}
   {packageFormOpen&&<form onSubmit={e=>guard(e,()=>void send('packages',{
    operationId:iso(),packageId:UUID.test(selectedPackage)?selectedPackage:iso(),
    title:title.trim(),priceEgp:Number(price),sessions:Number(sessions),
    active:(e.nativeEvent as SubmitEvent).submitter instanceof HTMLButtonElement?
     (e.nativeEvent as SubmitEvent).submitter?.dataset.active!=='false':true
   }))}>
    <label>اسم الباقة<input required minLength={2} maxLength={80}
     value={title} onChange={e=>{setTitle(e.target.value);setConfirmed(false);}}/></label>
    <label>السعر بالجنيه<input required type="number" min={1} max={100000} step={1}
     value={price} onChange={e=>{setPrice(e.target.value);setConfirmed(false);}}/></label>
    <label>عدد الحصص<input required type="number" min={1} max={60} step={1}
     value={sessions} onChange={e=>{setSessions(e.target.value);setConfirmed(false);}}/></label>
    <p>السعر الجديد للطلبات القادمة فقط.</p>
    <Confirm checked={confirmedForMode} onChange={confirmForMode}/>
    <button type="submit" disabled={!confirmedForMode||busy} data-active="true">
     {selectedPackage?'حفظ السعر والباقة':'إضافة باقة'}</button>
    {selectedPackage&&<button type="submit" disabled={!confirmedForMode||busy}
     data-active="false">تعطيل الباقة</button>}
    <button type="button" onClick={()=>{setPackageFormOpen(false);setConfirmed(false);}}>إلغاء</button>
   </form>}
  </>}
  {visibleData&&mode==='requests'&&<>
   <h3>طلبات الطلاب</h3>
   <div className={styles.options}>
   {visibleData.requests.length===0?<p>لا توجد طلبات اشتراك بعد.</p>:
    visibleData.requests.map(r=><label key={r.id}>
     <input type="radio" name="req" disabled={r.state!=='pending'}
      checked={selectedRequest===r.id}
      onChange={()=>{setSelectedRequest(r.id);setLearnerId(r.learnerId);
       setSelectedPackage(r.packageVersionId);setConfirmed(false);}}/>
     {r.learnerName} · {r.title} · {label(r.priceEgp)} جنيه
     {' · '}{r.state==='pending'?'في انتظار القرار':r.state}
    </label>)}
   </div>
   <h3>تفعيل اشتراك أو تسجيل دفع يدوي</h3>
   <p>يمكن تحديد طلب قائم أو إدخال معرّف طالب صحيح وتفعيل باقة مباشرة.
    التأكيد هنا إقرار إداري باستلام المبلغ خارج الموقع، وليس إيصالًا من واتساب.</p>
   <form onSubmit={e=>guard(e,()=>void send('activate',{
    operationId:iso(),learnerId:learnerId.trim(),
    packageVersionId:selectedPackage,
    requestId:selectedRequest||null,note:reason.trim(),manualConfirmed:true
   }))}>
    <label>معرّف ملف الطالب<input required value={learnerId}
     onChange={e=>{setLearnerId(e.target.value);setSelectedRequest('');
       setConfirmed(false);}}/></label>
    <label>الباقة (إصدار سعر ثابت)<select required value={selectedPackage}
     onChange={e=>{setSelectedPackage(e.target.value);setSelectedRequest('');
       setConfirmed(false);}}>
     <option value="">اختر الباقة</option>
     {selectedQuote&&academyAdminNeedsOriginalQuoteOption(selectedRequest,selectedPackage,
      visibleData.requests,visibleData.packages)&&
      <option value={selectedPackage}>
       إصدار الطلب الأصلي — {label(selectedQuote.priceEgp)} جنيه / {label(selectedQuote.sessions)} حصص
      </option>}
     {visibleData.packages.filter(p=>p.active===1).map(p=><option key={p.id} value={p.id}>
      {p.title} — {p.priceEgp} ج / {p.sessions} حصص</option>)}
    </select></label>
    <label>سبب/مرجع تأكيد الدفع<input required minLength={10} maxLength={500}
     value={reason} onChange={e=>{setReason(e.target.value);setConfirmed(false);}}
     placeholder="تم الاستلام يدويًا بعد التحقق من التحويل"/></label>
    <Confirm checked={confirmedForMode} onChange={confirmForMode}/>
    <button type="submit" disabled={!confirmedForMode||busy||!UUID.test(learnerId)||!UUID.test(selectedPackage)}>
     تأكيد الاستلام وتفعيل الاشتراك</button>
    {selectedRequest&&<button type="button"
     disabled={!academyAdminCanReject(visibleData.requests,selectedRequest,reason,confirmedForMode,busy)}
     onClick={()=>{
      if(!academyAdminCanReject(visibleData.requests,selectedRequest,reason,confirmedForMode,busy))return;
      void send('reject',{operationId:iso(),requestId:selectedRequest,
       reason:reason.trim()});
     }}>رفض الطلب مع تسجيل السبب</button>}
   </form>
  </>}
  {visibleData&&mode==='invites'&&<>
   <p>اضغط إنشاء رابط، ابعته للشيخ على واتساب؛ يسجّل بالاسم والموبايل
    وكلمة المرور فقط. الدعوة صالحة ٧ أيام وتُستخدم مرة واحدة.</p>
   <Confirm checked={confirmedForMode} onChange={confirmForMode}/>
   <button type="button" disabled={!confirmedForMode||busy}
    onClick={()=>void send('invites',{operationId:iso()})}>إنشاء رابط إضافة شيخ</button>
   {visibleInviteUrl&&<div role="status">
    <label>الرابط يظهر الآن فقط<input readOnly dir="ltr" value={visibleInviteUrl}/></label>
    <button type="button" onClick={()=>void navigator.clipboard.writeText(visibleInviteUrl)}>
     نسخ الرابط</button></div>}
   <h3>الدعوات المرسلة</h3>
   {visibleData.invites.map(i=><article key={i.id}>
    {academyAdminInviteDisplayName(i)} ·
    {' '}{academyAdminInviteStatusLabel(i,inviteNow)}
    {i.teacherId?' · موجود في دليل الشيوخ':''}
    {' · انتهاء: '}{date.format(new Date(i.expiresAtMs))}
    {i.claimed===1&&!i.teacherId&&<p>
     ملف الشيخ غير متاح في الدليل بعد؛ راجع السجل قبل الإسناد.</p>}
   </article>)}
  </>}
  {visibleData&&mode==='contact'&&<>
   <p>رقم دولي من غير علامة + أو مسافات؛ مثل 201xxxxxxxxx.
    زر الطالب يفتح واتساب فقط ولا يُفعّل اشتراكه.</p>
   <form onSubmit={e=>guard(e,()=>void send('contact',{
    operationId:iso(),whatsappNumber:whatsapp.trim()}))}>
    <label>رقم واتساب الأكاديمية<input required dir="ltr"
     inputMode="tel" pattern="[1-9][0-9]{9,14}" value={whatsapp}
     onChange={e=>{setWhatsapp(e.target.value);setConfirmed(false);}} /></label>
    <Confirm checked={confirmedForMode} onChange={confirmForMode}/>
    <button type="submit" disabled={!confirmedForMode||busy}>حفظ رقم الواتساب</button>
   </form>
  </>}
  {result.phase!=='idle'&&<p role={result.phase==='error'?'alert':'status'}>
   {result.message}</p>}
  {result.phase==='uncertain'&&visiblePendingOp&&<>
   {!academyAdminCanReplay(Boolean(visibleData),revokedStaff.current,
    academyAdminSessionLockIsBusy(sending.current,session))&&
    <p role="status">حدّث بيانات الإدارة وتحقق من صلاحية الحساب قبل إعادة العملية الأصلية.</p>}
   <button type="button"
    disabled={!academyAdminCanReplay(Boolean(visibleData),revokedStaff.current,
     academyAdminSessionLockIsBusy(sending.current,session))}
    onClick={()=>void send(visiblePendingOp.path,visiblePendingOp.payload)}>
    إعادة نفس العملية بمعرّفها الأصلي</button>
  </>}
 </section>;
}
function Confirm({checked,onChange}:{checked:boolean;onChange:(x:boolean)=>void}){
 return <label><input type="checkbox" checked={checked}
  onChange={e=>onChange(e.target.checked)}/>
  أؤكد أني راجعت بيانات العملية وأنفذها بصفتي مسؤولًا مفوضًا</label>;
}
