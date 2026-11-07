'use client';
import {useEffect,useRef,useState} from 'react';
import {readOwnerAcademy,latestPendingAcademyRequest,
 type AcademyOffer,type OwnerAcademy} from '../../shared';
import css from './StudentSubscription.module.css';

type View={phase:'loading'|'error';message:string}|
 {phase:'ready';data:OwnerAcademy;message:string};
const stateLabel:Record<string,string>={
 pending:'بانتظار موافقة الإدارة',activated:'تم التفعيل من الإدارة',rejected:'لم تتم الموافقة'
};
/** A network/proxy outcome may be unknown after D1 committed the request.
 * Do not mint a second operationId until the first is resolved. */
type PackageAttempt=Readonly<{learnerId:string;packageId:string;packageVersionId:string;operationId:string}>;
/** The version shown with the EGP price is part of the guardian's command. */
export function academyPackageRequestBody(next:PackageAttempt){
 return {operationId:next.operationId,packageId:next.packageId,
  packageVersionId:next.packageVersionId};
}
type WriteState='idle'|'busy'|'uncertain'|'confirming'|'denied';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function classifyAcademyPackageRequestResponse(status:number,raw:unknown):
 'ack'|'denied'|'uncertain'{
 // A generic 409 (proxy, stale gateway or malformed Worker response) is not
 // proof that D1 rejected the write. Preserve the immutable operationId for
 // exact replay unless the Worker returned a recognized deterministic conflict.
 if(status===409){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return 'uncertain';
  const error=raw as Record<string,unknown>;
  return Object.keys(error).length===1&&
   (error.code==='ACADEMY_OPERATION_CONFLICT'||
    error.code==='ACADEMY_PACKAGE_CHANGED'||
    error.code==='ACADEMY_REQUEST_DENIED')?'denied':'uncertain';
 }
 // Only a recognized, exact Worker error proves a 4xx was decided before
 // a durable academy write. A proxy may replace a committed POST response
 // with a generic 400/401/403/404/422: keep its operationId for replay.
 if(status>=400&&status<500){
  if([408,425,429].includes(status)||!raw||typeof raw!=='object'||Array.isArray(raw))
   return 'uncertain';
  const error=raw as Record<string,unknown>;
  const codes:Record<number,string>={400:'ACADEMY_INVALID_REQUEST',
   401:'UNAUTHENTICATED',403:'BAD_ORIGIN',404:'NOT_FOUND',
   405:'METHOD_NOT_ALLOWED'};
  const expected=codes[status];
  return expected!==undefined&&Object.keys(error).length===1&&error.code===expected?
   'denied':'uncertain';
 }
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return 'uncertain';
 const data=raw as Record<string,unknown>;
 const validCode=(status===201&&data.code==='ACADEMY_REQUEST_CREATED')||
  (status===200&&data.code==='ACADEMY_REQUEST_REPLAY');
 return validCode&&typeof data.academyRequestId==='string'&&
  UUID.test(data.academyRequestId)&&
  Object.keys(data).every(k=>['code','academyRequestId'].includes(k))?
  'ack':'uncertain';
}
export function createAcademyPackageRequestGate(){
 let state:'idle'|'busy'|'uncertain'|'closed'='idle';
 return {
  begin(retry=false){
   if(state!==(retry?'uncertain':'idle'))return false;
   state='busy';return true;
  },
  finish(uncertain:boolean){
   if(state==='busy')state=uncertain?'uncertain':'closed';
  },
  releaseAfterRead(){
   if(state!=='closed')return false;
   state='idle';return true;
  },
  status:()=>state
 };
}
/** A GET can finish between a refresh click and React effect cleanup.
 * Invalidate it synchronously before displaying new learner/catalog state. */
export function createAcademyReadEpoch(){
 let epoch=0;
 return {
  start:()=>++epoch,
  invalidate:()=>{epoch++;},
  isCurrent:(token:number)=>token===epoch
 };
}
/** The same-operation replay must remain reachable even when the catalog
 * GET fails after an ambiguous POST; it never mints a new operation ID. */
export function AcademyUncertainRequestRecovery({onRetry}:{onRetry:()=>void}){
 return <div role="alert" className={css.message}>
  <p>لم نتأكد من نتيجة الطلب. أعد نفس العملية فقط دون إنشاء طلب آخر.</p>
  <button type="button" className={css.buttonOutline} onClick={onRetry}>
   إعادة نفس طلب الباقة</button>
 </div>;
}

/** Key the entire signed request lifecycle by learner, not just its GET effect.
 * A sibling switch must never inherit an in-flight write, replay token, or
 * old request list from the previous learner's mounted component. */
export function ConnectedAcademyOffers({learnerId}:{learnerId:string}){
 return <ScopedAcademyOffers key={learnerId} learnerId={learnerId}/>;
}
function ScopedAcademyOffers({learnerId}:{learnerId:string}){
 const [view,setView]=useState<View>({phase:'loading',message:''});
 const [retry,setRetry]=useState(0);
 const [writeState,setWriteState]=useState<WriteState>('idle');
 const [attempt,setAttempt]=useState<PackageAttempt|null>(null);
 const gate=useRef(createAcademyPackageRequestGate());
 const readEpoch=useRef(createAcademyReadEpoch());
 const acknowledgedId=useRef<string|null>(null);
 useEffect(()=>{
  const ctrl=new AbortController();
  const token=readEpoch.current.start();
  setView({phase:'loading',message:''});
  void readOwnerAcademy(learnerId,ctrl.signal).then(data=>{
   if(ctrl.signal.aborted||!readEpoch.current.isCurrent(token))return;
   if(gate.current.status()==='closed'){
    // A successful POST ACK is not enough to unlock a second request:
    // first observe its immutable ID in the signed owner D1 read.
    if(acknowledgedId.current&&
       !data.requests.some(r=>r.id===acknowledgedId.current)){
     setWriteState('confirming');
     setView({phase:'ready',data,
      message:'تم تأكيد الطلب، لكن لم يظهر بعد في السجل. حدّث للتحقق؛ لا ترسل طلبًا جديدًا.'});
     return;
    }
    acknowledgedId.current=null;
    gate.current.releaseAfterRead();
    setWriteState('idle');
   }
   // A fresh GET must NOT silently discard an uncertain POST. The owner
   // can resolve it only by replaying the same immutable operationId.
   setView({phase:'ready',data,message:''});
  }).catch(()=>{
   if(!ctrl.signal.aborted&&readEpoch.current.isCurrent(token))
    setView({phase:'error',message:'تعذّر تحميل الباقات وطلباتك.'});
  });
  return()=>{ctrl.abort();readEpoch.current.invalidate();};
 },[learnerId,retry]);
 function refresh(){
  readEpoch.current.invalidate();
  setView({phase:'loading',message:''});
  setRetry(n=>n+1);
 }
 async function send(next:PackageAttempt,replay=false){
  if(next.learnerId!==learnerId||!gate.current.begin(replay))return;
  readEpoch.current.invalidate();
  setAttempt(next);setWriteState('busy');
  let status=0;
  let raw:unknown=null;
  try{
   const response=await fetch('/v1/me/learners/'+encodeURIComponent(next.learnerId)+'/academy',{
    method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(academyPackageRequestBody(next))});
   status=response.status;
   try{raw=await response.json();}catch{raw=null;}
  }catch{status=0;}
  const outcome=classifyAcademyPackageRequestResponse(status,raw);
  gate.current.finish(outcome==='uncertain');
  if(outcome==='ack'){
   acknowledgedId.current=(raw as {academyRequestId:string}).academyRequestId;
   setAttempt(null);setWriteState('confirming');
   setView({phase:'loading',message:''});
   refresh();
  }else if(outcome==='denied'){
   acknowledgedId.current=null;
   setAttempt(null);setWriteState('denied');
   setView({phase:'error',
    message:'رفض الخادم طلب الباقة. حدّث السجل قبل تقديم طلب جديد.'});
  }else{
   setWriteState('uncertain');
   setView(prev=>prev.phase==='ready'?{...prev,
    message:'نتيجة الطلب غير مؤكدة. أعد نفس العملية فقط بمعرّفها الأصلي؛ لا ترسل طلبًا جديدًا.'}:prev);
  }
 }
 function request(pkg:AcademyOffer){
  if(view.phase!=='ready'||writeState!=='idle'||
   latestPendingAcademyRequest(view.data))return;
  void send({learnerId,operationId:crypto.randomUUID(),packageId:pkg.packageId,
   packageVersionId:pkg.versionId});
 }
 const data=view.phase==='ready'?view.data:null;
 const pending=data?latestPendingAcademyRequest(data):null;
 return <section className={css.catalogSection} aria-label="باقات الأكاديمية">
  <div className={css.catalogHeader}><h2 className={css.sectionTitle}>الباقات المتاحة</h2>
   {(view.phase==='error'||writeState==='confirming')&&<button type="button" className={css.buttonOutline}
    onClick={refresh}>تحديث</button>}</div>
  {view.phase==='loading'?<p className={css.loading} role="status">جارٍ تحميل الباقات…</p>:
   view.phase==='error'?<p className={css.message} role="alert">{view.message}</p>:<>
   {pending&&<div className={css.pending} role="status">
    <span>طلب {pending.title} قيد مراجعة الإدارة</span>
    <span>استكمال الدفع عبر واتساب بعد التواصل مع الأكاديمية</span>
   </div>}
   {view.message&&<p className={css.message+' '+css.error} role="alert">{view.message}</p>}
   {data!.packages.length===0?<p className={css.message}>
    لا توجد باقات متاحة حاليًا. تواصل مع الأكاديمية للاستفسار.</p>:
    <div className={css.packages}>{data!.packages.map(pkg=>
     <article className={css.package} key={pkg.versionId}>
      <h3>{pkg.title}</h3>
      <div className={css.packagePrice}>{pkg.priceEgp.toLocaleString('ar-EG')}
       <small> جنيه / شهر</small></div>
      <div className={css.packageSessions}>{pkg.sessions.toLocaleString('ar-EG')} حصص شهريًا</div>
      <button type="button" className={css.button}
       disabled={writeState!=='idle'||!!pending}
       onClick={()=>void request(pkg)}>
       {writeState==='busy'?'جارٍ إرسال الطلب…':pending?'لديك طلب قيد المراجعة':'اطلب الباقة'}</button>
     </article>)}</div>}
   {writeState==='confirming'&&<p className={css.message} role="status">
    جارٍ تأكيد ظهور الطلب في سجل الأكاديمية؛ لا ترسل طلبًا جديدًا.</p>}
   {data!.whatsappNumber&&<div className={css.contact}>
    <p>لإتمام الدفع أو السؤال عن باقة، تواصل مع الأكاديمية.</p>
    <a className={css.buttonOutline} target="_blank" rel="noopener noreferrer"
     href={'https://wa.me/'+data!.whatsappNumber+'?text='+encodeURIComponent(
      'السلام عليكم، أريد الاستفسار عن باقات نور القرآن واستكمال الاشتراك.')}>
     تواصل عبر واتساب</a></div>}
   {data!.requests.length>0&&<details className={css.requests}>
    <summary>طلبات الاشتراك السابقة ({data!.requests.length})</summary>
    {data!.requests.map(req=><div className={css.requestLine} key={req.id}>
     <div><strong>{req.title}</strong>
      <div className={css.meta}>{req.priceEgp.toLocaleString('ar-EG')} جنيه</div></div>
     <span className={css.status}>{stateLabel[req.state]}</span>
    </div>)}
   </details>}
  </>}
  {writeState==='uncertain'&&attempt&&
   <AcademyUncertainRequestRecovery onRetry={()=>void send(attempt,true)}/>}
 </section>;
}
