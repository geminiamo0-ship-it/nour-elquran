'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {AccountSession} from '@/features/account';
import styles from './AdminAcademyMvp.module.css';
import {academyPendingStore,type AcademyPendingCommand} from './admin-academy-pending';
import {parseAdminAcademyRead,type AdminAcademySnapshot as Academy} from './admin-academy-read';
type Result={phase:'idle'|'busy'|'done'|'error'|'uncertain';message:string};
type AcademyReadPhase='loading'|'ready'|'error'|'denied';
/** Empty staff state must never keep displaying a loading message after a failed read. */
export function academyAdminEmptyReadMessage(phase:AcademyReadPhase):string|null{
 if(phase==='loading')return 'جارٍ تحميل البيانات المصرح بها…';
 if(phase==='denied')return 'تم إخفاء بيانات الإدارة لعدم توفر الصلاحية.';
 if(phase==='error')return 'تعذّر تحميل بيانات الأكاديمية. اضغط تحديث البيانات للمحاولة مجددًا.';
 return null;
}
type Mode='packages'|'requests'|'invites'|'contact';
type PendingOp=AcademyPendingCommand;
const uncertainMessage='تعذّر تأكيد العملية السابقة. لا تبدأ تفعيلًا جديدًا؛ أعد نفس العملية بمعرّفها الأصلي.';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const iso=()=>crypto.randomUUID();
const date=new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',dateStyle:'medium'});
function label(v:number){return v.toLocaleString('ar-EG');}
async function readAcademy(signal:AbortSignal):Promise<Academy>{
 const res=await fetch('/v1/staff/academy',{credentials:'same-origin',cache:'no-store',
  redirect:'error',signal});
 if(res.status===401||res.status===403)
  throw new AcademyCommandError('STAFF_ACCESS_DENIED',res.status);
 const v:unknown=await res.json();
 if(!res.ok)throw new Error('تعذّر قراءة الإدارة من الخادم');
 return parseAdminAcademyRead(v);
}
const operationErrors:Record<string,string>={
 ACADEMY_REQUEST_ALREADY_ACTIVATED:'الطلب اتفعّل بالفعل. اضغط تحديث وشوف الاشتراك في ملف الطالب.',
 ACADEMY_REQUEST_NOT_FOUND:'طلب الاشتراك غير موجود. حدّث قائمة الطلبات.',
 ACADEMY_REQUEST_REJECTED:'الطلب مرفوض ولا يمكن تفعيله. راجع الطلب قبل المحاولة.',
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
class AcademyCommandError extends Error{
 constructor(readonly code:string,readonly status:number){super(code);}
}
/** A fresh staff authorization denial hides previously signed academy data.
 * Domain-rule 403 responses do not imply revoked staff privileges. */
export function academyAdminStaffAccessRevoked(status:number,code:string){
 return status===401||(status===403&&code==='STAFF_ACCESS_DENIED')||
  ((status===403||status===409)&&code==='ACADEMY_STAFF_ACCESS_CHANGED');
}
/** A late roster response cannot resurrect data after a newer staff denial. */
export function academyAdminReadMayApply(aborted:boolean,revoked:boolean){
 return !aborted&&!revoked;
}
/** A slower signed GET cannot replace a newer post-write or manual refresh. */
export function academyAdminReadEpochMayApply(
 started:number,current:number,aborted:boolean,revoked:boolean){
 return started===current&&academyAdminReadMayApply(aborted,revoked);
}
/** A 5xx or retryable HTTP response cannot prove whether D1 committed.
 * Preserve the original operationId and prohibit a second financial command. */
export function academyAdminOutcomeIsUncertain(status:number){
 return status===408||status===425||status===429||status>=500;
}
/** An in-flight staff response must never be applied after account/session swap. */
export function academyAdminSameSession<T>(started:T,current:T){
 return started===current;
}
/** Block even a single render of stale staff data, form values or invite secrets. */
export function academyAdminSessionViewIsReady<T>(rendered:T,current:T){
 return academyAdminSameSession(rendered,current);
}
/** A revoked staff session cannot apply a late successful mutation receipt,
 * including a one-use Sheikh invite token, even if its session object matches. */
export function academyAdminMutationMayApply<T>(started:T,current:T,revoked:boolean){
 return academyAdminSameSession(started,current)&&!revoked;
}
/** New commands and exact-operation retries require a fresh signed staff read. */
export function academyAdminCanSend(
 phase:AcademyReadPhase,hasSnapshot:boolean,revoked:boolean){
 return phase==='ready'&&hasSnapshot&&!revoked;
}
/** The reject button bypasses native form submission validation.
 * Require a real pending D1 request and a usable audit reason before POST. */
export function academyAdminCanReject(
 requests:ReadonlyArray<{id:string;state:string}>,
 requestId:string,reason:string,confirmed:boolean,busy:boolean){
 const note=reason.trim();
 return confirmed&&!busy&&note.length>=10&&note.length<=500&&
  requests.some(r=>r.id===requestId&&r.state==='pending');
}
/** A pending unknown POST outcome must not disable the read-only refresh
 * needed to restore a signed staff snapshot before an exact-operation retry.
 * Only an actively sending command disables the refresh button. */
export function academyAdminCanRefresh(phase:Result['phase']){
 return phase!=='busy';
}
/** An unfinished request from an old staff session must not lock the new one. */
export function academyAdminSessionLockIsBusy<T>(inFlightSession:T|null,session:T){
 return inFlightSession!==null&&academyAdminSameSession(inFlightSession,session);
}
/** Preserve a financial retry across a same-actor session refresh, never across accounts. */
export function academyAdminPendingForActor<T extends {actorId:string}>(
 pending:T|null,actorId:string):T|null{
 return pending?.actorId===actorId?pending:null;
}
/** Only the exact held payload may be resent while its outcome is uncertain. */
export function academyAdminCommandAllowed(
 pending:PendingOp|null,actorId:string,path:string,payload:unknown){
 const held=academyAdminPendingForActor(pending,actorId);
 return held===null||(held.path===path&&held.payload===payload);
}
/** A 2xx response alone is not a durable staff command acknowledgement.
 * Reject unexpected codes/statuses (including proxy 202/204 and malformed
 * one-use invite receipts) without clearing the original operationId. */
export function academyAdminAckIsVerified(path:string,status:number,raw:unknown,command:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 const v=raw as Record<string,unknown>;
 const codes:Record<string,readonly [string,string?]>={
  packages:['ACADEMY_PACKAGE_SAVED','ACADEMY_PACKAGE_REPLAY'],
  activate:['ACADEMY_SUBSCRIPTION_ACTIVATED','ACADEMY_ACTIVATION_REPLAY'],
  reject:['ACADEMY_REQUEST_REJECTED','ACADEMY_REQUEST_REJECTION_REPLAY'],
  contact:['ACADEMY_WHATSAPP_SAVED','ACADEMY_CONTACT_REPLAY'],
  invites:['ACADEMY_INVITE_ISSUED'],
 };
 const expected=codes[path];
 if(!expected||!((status===201&&v.code===expected[0])||
  (status===200&&v.code===expected[1]&&expected[1]!==undefined)))return false;
 // Package writes echo the affected package ID. Never clear an uncertain
 // operation if a valid-looking ACK belongs to a different package.
 if(path==='packages'){
  if(!command||typeof command!=='object'||Array.isArray(command))return false;
  const expectedPackageId=(command as Record<string,unknown>).packageId;
  if(typeof expectedPackageId!=='string'||v.packageId!==expectedPackageId)return false;
 }
 // A fresh activation ACK must include the authoritative D1 cycle window.
 // A 200 immutable replay intentionally has only its replay code; the staff
 // must re-read the signed ledger before initiating another operation.
 if(path==='activate'&&status===201){
  if(!Number.isSafeInteger(v.startsAtMs)||!Number.isSafeInteger(v.endsAtMs)||
   typeof v.startsAtMs!=='number'||typeof v.endsAtMs!=='number'||
   v.startsAtMs<0||v.endsAtMs<=v.startsAtMs||
   v.endsAtMs>8_640_000_000_000_000||
   !Number.isSafeInteger(v.rolloverSessions)||typeof v.rolloverSessions!=='number'||
   v.rolloverSessions<0||v.rolloverSessions>60)return false;
 }
 if(path==='invites'){
  // A one-use invite expires in seven days. A valid-looking token must not
  // clear an uncertain write if the receipt advertises an impossible TTL.
  const now=Date.now();
  return status===201&&typeof v.token==='string'&&
   /^[0-9a-f]{64}$/.test(v.token)&&typeof v.expiresAtMs==='number'&&
   Number.isSafeInteger(v.expiresAtMs)&&v.expiresAtMs>now&&
   v.expiresAtMs<=8_640_000_000_000_000&&
   v.expiresAtMs<=now+7*86400000+5*60000;
 }
 return true;
}
async function submit(path:string,command:unknown){
 const res=await fetch('/v1/staff/academy/'+path,{method:'POST',
  credentials:'same-origin',cache:'no-store',redirect:'error',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(command)});
 // An unsigned response must never leave an old one-use invite or staff
 // learner list on screen, even when a proxy returns no JSON body.
 if(res.status===401)throw new AcademyCommandError('STAFF_ACCESS_DENIED',401);
 let v:unknown;
 try{v=await res.json();}catch{
  if(res.status===403)throw new AcademyCommandError('STAFF_ACCESS_DENIED',403);
  throw new Error('استجابة غير صالحة');
 }
 if(!v||typeof v!=='object'||Array.isArray(v)||typeof (v as {code?:unknown}).code!=='string')
  throw new Error('استجابة غير صالحة');
 const code=(v as {code:string}).code;
 if(!res.ok)throw new AcademyCommandError(code,res.status);
 if(!academyAdminAckIsVerified(path,res.status,v,command))
  throw new Error('استجابة تأكيد غير موثوقة');
 return {code,...(v as object)};
}
/** Operations never optimistically claim a payment or an activation. */
export function AdminAcademyMvp({session,mode}:{session:AccountSession;mode:Mode}){
 const [data,setData]=useState<Academy|null>(null);
 const [readPhase,setReadPhase]=useState<AcademyReadPhase>('loading');
 const [refresh,setRefresh]=useState(0);
 const [result,setResult]=useState<Result>({phase:'idle',message:''});
 const [title,setTitle]=useState('');
 const [price,setPrice]=useState('');
 const [sessions,setSessions]=useState('8');
 const [selectedPackage,setSelectedPackage]=useState('');
 const [selectedRequest,setSelectedRequest]=useState('');
 const [learnerId,setLearnerId]=useState('');
 const [reason,setReason]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [whatsapp,setWhatsapp]=useState('');
 const [inviteUrl,setInviteUrl]=useState('');
 const [pendingOp,setPendingOp]=useState<PendingOp|null>(null);
 const [visibleSession,setVisibleSession]=useState(session);
 const pendingOpRef=useRef<PendingOp|null>(null);
 const sending=useRef<{session:AccountSession;attempt:object}|null>(null);
 const currentSession=useRef(session);
 const revokedStaff=useRef(false);
 const readEpoch=useRef(0);
 currentSession.current=session;
 function invalidateStaffData(){
  revokedStaff.current=true;
  setReadPhase('denied');
  setData(null);setInviteUrl('');setWhatsapp('');setConfirmed(false);
 }
 // A new session must not paint the previous staff actor's data, selected
 // learner, settlement note or one-use Sheikh invitation before effects run.
 useEffect(()=>{
  if(academyAdminSessionViewIsReady(visibleSession,session))return;
  setReadPhase('loading');
  setData(null);setInviteUrl('');setTitle('');setPrice('');setSessions('8');
  setSelectedPackage('');setSelectedRequest('');setLearnerId('');
  setReason('');setConfirmed(false);setWhatsapp('');setPendingOp(null);
  setResult({phase:'idle',message:''});
  setVisibleSession(session);
 },[visibleSession,session]);
 useEffect(()=>{
  const ctrl=new AbortController();
  const epoch=++readEpoch.current;
  revokedStaff.current=false;
  setReadPhase('loading');
  setData(null);setInviteUrl('');
  // Session objects change on re-authentication. Do not lose an uncertain
  // activation's original operationId when the authenticated actor is unchanged.
  const held=academyPendingStore.forActor(session.user.id);
  pendingOpRef.current=held;
  setPendingOp(held);
  setResult(held?{phase:'uncertain',message:uncertainMessage}:
   {phase:'idle',message:''});
  void readAcademy(ctrl.signal).then(v=>{
   if(academyAdminReadEpochMayApply(epoch,readEpoch.current,
    ctrl.signal.aborted,revokedStaff.current)){
    setData(v);setReadPhase('ready');setWhatsapp(v.whatsappNumber??'');
   }
  }).catch(e=>{
   if(ctrl.signal.aborted||epoch!==readEpoch.current)return;
   if(e instanceof AcademyCommandError&&academyAdminStaffAccessRevoked(e.status,e.code))
    invalidateStaffData();
   else setReadPhase('error');
   if(!pendingOpRef.current)setResult({phase:'error',
    message:e instanceof Error?e.message:'تعذّر تحميل البيانات'});
  });
  return()=>ctrl.abort();
 },[session,refresh]);
 const busy=result.phase==='busy'||result.phase==='uncertain';
 async function send(path:string,payload:unknown){
  if(!academyAdminCanSend(readPhase,data!==null,revokedStaff.current))return;
  if(academyAdminSessionLockIsBusy(sending.current?.session??null,session))return;
  const held=academyPendingStore.forActor(session.user.id);
  // A new financial operation cannot replace an unresolved original payload.
  if(!academyAdminCommandAllowed(held,session.user.id,path,payload))return;
  const operation:PendingOp=held??{actorId:session.user.id,path,payload};
  // A remounted academy panel shares the same unresolved in-tab command.
  if(!academyPendingStore.hold(operation))return;
  const attempt={};
  // Do not race a still-running old-panel POST after a remount.
  if(!academyPendingStore.beginAttempt(operation,attempt))return;
  sending.current={session,attempt};
  const startedSession=session;
  const stillCurrent=()=>academyAdminMutationMayApply(
   startedSession,currentSession.current,revokedStaff.current);
  setResult({phase:'busy',message:'جارٍ تسجيل العملية لدى الخادم…'});
  pendingOpRef.current=operation;
  setPendingOp(operation);
  try{
   const ack=await submit(path,payload);
   if(!stillCurrent())return;
   setResult({phase:'done',message:'سجّل الخادم العملية: '+ack.code});
   setConfirmed(false);setReason('');
   // Do not retain a terminal request selection after its authoritative ACK.
   // A subsequent activation/rejection requires an explicit fresh selection.
   if(path==='activate'||path==='reject'){
    setSelectedRequest('');setSelectedPackage('');setLearnerId('');
   }
   academyPendingStore.clearIfSame(operation);
   if(pendingOpRef.current===operation){pendingOpRef.current=null;setPendingOp(null);}
   if(path==='invites'&&typeof (ack as {token?:unknown}).token==='string'){
    const token=(ack as {code:string;token?:string}).token!;
    setInviteUrl(window.location.origin+'/teacher/join?token='+token);
   }else{
    // A committed write invalidates every older roster GET. Keep the signed
    // receipt visible, but require a fresh list before another command.
    const epoch=++readEpoch.current;
    setData(null);setReadPhase('loading');
    const ctrl=new AbortController();
    void readAcademy(ctrl.signal).then(v=>{
     if(stillCurrent()&&academyAdminReadEpochMayApply(epoch,readEpoch.current,
      ctrl.signal.aborted,revokedStaff.current)){
      setData(v);setReadPhase('ready');setWhatsapp(v.whatsappNumber??'');
     }
    }).catch(e=>{
     if(!stillCurrent()||epoch!==readEpoch.current||ctrl.signal.aborted)return;
     if(e instanceof AcademyCommandError&&academyAdminStaffAccessRevoked(e.status,e.code)){
      invalidateStaffData();
      setResult({phase:'error',message:operationErrors.ACADEMY_STAFF_ACCESS_CHANGED??'صلاحية الإدارة اتغيرت.'});
     }else{
      // A failed reconciliation is not permission to act on a stale snapshot.
      setData(null);setReadPhase('error');
     }
    });
   }
  }catch(e){
   if(!stillCurrent())return;
   if(e instanceof AcademyCommandError&&academyAdminStaffAccessRevoked(e.status,e.code))
    invalidateStaffData();
   if(e instanceof AcademyCommandError&&!academyAdminOutcomeIsUncertain(e.status)){
    academyPendingStore.clearIfSame(operation);
   if(pendingOpRef.current===operation){pendingOpRef.current=null;setPendingOp(null);}
    setResult({phase:'error',message:operationErrors[e.code]??'تعذّر تنفيذ العملية: '+e.code});
   }else{
    // Keep the immutable payload for an explicit same-operation retry.
    // A 503 can mean the D1 write committed but its ACK was lost.
    setResult({phase:'uncertain',message:uncertainMessage});
   }
  }finally{
   academyPendingStore.finishAttempt(attempt);
   // A late old-session request must not unlock a newer session's command.
   if(sending.current?.attempt===attempt)sending.current=null;
  }
 }
 function guard(event:FormEvent,action:()=>void){
  event.preventDefault();if(!confirmed||busy||!data)return;action();
 }
 const modeTitle={packages:'الباقات والأسعار',requests:'طلبات الاشتراك وتفعيل الطلاب',
  invites:'إضافة شيخ بدعوة',contact:'واتساب الأكاديمية'}[mode];
 if(!academyAdminSessionViewIsReady(visibleSession,session))
  return <section dir="rtl" className={styles.root} aria-label="التحقق من جلسة الإدارة">
   <p role="status">جارٍ التحقق من جلسة الإدارة…</p>
  </section>;
 return <section dir="rtl" className={styles.root} aria-label={modeTitle}>
  <h2>{modeTitle}</h2>
  <p>كل تعديل يتطلب صلاحية الإدارة الحالية وتأكيدًا صريحًا. الدفع لا يُثبت تلقائيًا من واتساب.</p>
  <button type="button" onClick={()=>{
   ++readEpoch.current;setData(null);setReadPhase('loading');
   setRefresh(n=>n+1);
  }} disabled={!academyAdminCanRefresh(result.phase)}>
   تحديث البيانات</button>
  {!data&&academyAdminEmptyReadMessage(readPhase)&&
   <p role={readPhase==='loading'?'status':'alert'}>
    {academyAdminEmptyReadMessage(readPhase)}</p>}
  {data&&mode==='packages'&&<>
   <h3>الباقات المسجلة</h3>
   {data.packages.length===0?<p>لا توجد باقات مضافة بعد.</p>:
    <div className={styles.options}>
     {data.packages.map(p=><article key={p.id}>
      <strong>{p.title}</strong> — {label(p.priceEgp)} جنيه / {label(p.sessions)} حصص
      {' · '}{p.active===1?'متاحة':'موقوفة'}
      <button type="button" onClick={()=>{
       setSelectedPackage(p.packageId);setTitle(p.title);setPrice(String(p.priceEgp));
       setSessions(String(p.sessions));setConfirmed(false);
      }}>تعديل الإصدار القادم</button>
     </article>)}
    </div>}
   <form onSubmit={e=>guard(e,()=>void send('packages',{
    operationId:iso(),packageId:UUID.test(selectedPackage)?selectedPackage:iso(),
    title:title.trim(),priceEgp:Number(price),sessions:Number(sessions),
    active:(e.nativeEvent as SubmitEvent).submitter instanceof HTMLButtonElement?
     (e.nativeEvent as SubmitEvent).submitter?.dataset.active!=='false':true
   }))}>
    <label>اسم الباقة<input required minLength={2} maxLength={80}
     value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label>السعر بالجنيه<input required type="number" min={1} max={100000} step={1}
     value={price} onChange={e=>setPrice(e.target.value)}/></label>
    <label>عدد الحصص<input required type="number" min={1} max={60} step={1}
     value={sessions} onChange={e=>setSessions(e.target.value)}/></label>
    <p>الإصدار الجديد لا يغيّر أسعار الطلبات أو الاشتراكات السابقة.</p>
    <Confirm checked={confirmed} onChange={setConfirmed}/>
    <button type="submit" disabled={!confirmed||busy} data-active="true">
     {selectedPackage?'حفظ السعر والباقة':'إضافة باقة'}</button>
    {selectedPackage&&<button type="submit" disabled={!confirmed||busy}
     data-active="false">تعطيل الباقة</button>}
    {selectedPackage&&<button type="button" onClick={()=>{
     setSelectedPackage('');setTitle('');setPrice('');setSessions('8');setConfirmed(false);
    }}>باقة جديدة</button>}
   </form>
  </>}
  {data&&mode==='requests'&&<>
   <h3>طلبات الطلاب</h3>
   <div className={styles.options}>
   {data.requests.length===0?<p>لا توجد طلبات اشتراك بعد.</p>:
    data.requests.map(r=><label key={r.id}>
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
     onChange={e=>{setLearnerId(e.target.value);setSelectedRequest('');}}/></label>
    <label>الباقة (إصدار سعر ثابت)<select required value={selectedPackage}
     onChange={e=>{setSelectedPackage(e.target.value);setSelectedRequest('');}}>
     <option value="">اختر الباقة</option>
     {selectedRequest&&!data.packages.some(p=>p.id===selectedPackage)&&
      <option value={selectedPackage}>
       إصدار السعر الأصلي المرتبط بطلب الطالب
      </option>}
     {data.packages.filter(p=>p.active===1).map(p=><option key={p.id} value={p.id}>
      {p.title} — {p.priceEgp} ج / {p.sessions} حصص</option>)}
    </select></label>
    <label>سبب/مرجع تأكيد الدفع<input required minLength={10} maxLength={500}
     value={reason} onChange={e=>setReason(e.target.value)}
     placeholder="تم الاستلام يدويًا بعد التحقق من التحويل"/></label>
    <Confirm checked={confirmed} onChange={setConfirmed}/>
    <button type="submit" disabled={!confirmed||busy||!UUID.test(learnerId)||!UUID.test(selectedPackage)}>
     تأكيد الاستلام وتفعيل الاشتراك</button>
    {selectedRequest&&<button type="button"
     disabled={!academyAdminCanReject(data.requests,selectedRequest,reason,confirmed,busy)}
     onClick={()=>{
      if(!academyAdminCanReject(data.requests,selectedRequest,reason,confirmed,busy))return;
      void send('reject',{operationId:iso(),requestId:selectedRequest,
       reason:reason.trim()});
     }}>رفض الطلب مع تسجيل السبب</button>}
   </form>
  </>}
  {data&&mode==='invites'&&<>
   <p>اضغط إنشاء رابط، ابعته للشيخ على واتساب؛ يسجّل بالاسم والموبايل
    وكلمة المرور فقط. الدعوة صالحة ٧ أيام وتُستخدم مرة واحدة.</p>
   <Confirm checked={confirmed} onChange={setConfirmed}/>
   <button type="button" disabled={!confirmed||busy}
    onClick={()=>void send('invites',{operationId:iso()})}>إنشاء رابط إضافة شيخ</button>
   {inviteUrl&&<div role="status">
    <label>الرابط يظهر الآن فقط<input readOnly dir="ltr" value={inviteUrl}/></label>
    <button type="button" onClick={()=>void navigator.clipboard.writeText(inviteUrl)}>
     نسخ الرابط</button></div>}
   <h3>الدعوات المرسلة</h3>
   {data.invites.map(i=><article key={i.id}>
    {i.teacherName??'لم يُستخدم الرابط بعد'} ·
    {' '}{i.claimed===1?'تم تسجيل حساب الشيخ':'بانتظار التسجيل'}
    {i.teacherId?' · موجود في دليل الشيوخ':''}
    {' · انتهاء: '}{date.format(new Date(i.expiresAtMs))}
    {i.claimed===1&&!i.teacherId&&<p>
     تم تسجيل الحساب لكن ملف الشيخ غير متاح في الدليل بعد؛ راجع السجل قبل الإسناد.
    </p>}
   </article>)}
  </>}
  {data&&mode==='contact'&&<>
   <p>رقم دولي من غير علامة + أو مسافات؛ مثل 201xxxxxxxxx.
    زر الطالب يفتح واتساب فقط ولا يُفعّل اشتراكه.</p>
   <form onSubmit={e=>guard(e,()=>void send('contact',{
    operationId:iso(),whatsappNumber:whatsapp.trim()}))}>
    <label>رقم واتساب الأكاديمية<input required dir="ltr"
     inputMode="tel" pattern="[1-9][0-9]{9,14}" value={whatsapp}
     onChange={e=>setWhatsapp(e.target.value)} /></label>
    <Confirm checked={confirmed} onChange={setConfirmed}/>
    <button type="submit" disabled={!confirmed||busy}>حفظ رقم الواتساب</button>
   </form>
  </>}
  {result.phase!=='idle'&&<p role={result.phase==='error'?'alert':'status'}>
   {result.message}</p>}
  {result.phase==='uncertain'&&pendingOp&&
   academyAdminCanSend(readPhase,data!==null,revokedStaff.current)&&<button type="button"
   onClick={()=>void send(pendingOp.path,pendingOp.payload)}>إعادة نفس العملية بمعرّفها الأصلي</button>}
 </section>;
}
function Confirm({checked,onChange}:{checked:boolean;onChange:(x:boolean)=>void}){
 return <label><input type="checkbox" checked={checked}
  onChange={e=>onChange(e.target.checked)}/>
  أؤكد أني راجعت بيانات العملية وأنفذها بصفتي مسؤولًا مفوضًا</label>;
}
