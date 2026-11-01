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
export function ConnectedAcademyOffers({learnerId}:{learnerId:string}){
 const [view,setView]=useState<View>({phase:'loading',message:''});
 const [retry,setRetry]=useState(0);
 const [sending,setSending]=useState(false);
 const [uncertain,setUncertain]=useState(false);
 const busyRef=useRef(false);
 useEffect(()=>{
  const ctrl=new AbortController();
  setView({phase:'loading',message:''});
  void readOwnerAcademy(learnerId,ctrl.signal).then(data=>{
   if(!ctrl.signal.aborted){setView({phase:'ready',data,message:''});setUncertain(false);}
  }).catch(()=>{if(!ctrl.signal.aborted)
   setView({phase:'error',message:'تعذّر تحميل الباقات وطلباتك.'});});
  return()=>ctrl.abort();
 },[learnerId,retry]);
 async function request(pkg:AcademyOffer){
  if(view.phase!=='ready'||busyRef.current||uncertain||
   latestPendingAcademyRequest(view.data))return;
  busyRef.current=true;setSending(true);
  const operationId=crypto.randomUUID();
  try{
   const response=await fetch('/v1/me/learners/'+encodeURIComponent(learnerId)+'/academy',{
    method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({operationId,packageId:pkg.packageId})});
   const raw:unknown=await response.json();
   if(!response.ok||!raw||typeof raw!=='object'||Array.isArray(raw)||
     !['ACADEMY_REQUEST_CREATED','ACADEMY_REQUEST_REPLAY'].includes(
      String((raw as {code?:unknown}).code)))throw Error('ACADEMY_UNKNOWN_RESULT');
   setRetry(n=>n+1);
  }catch{
   setUncertain(true);
   setView(prev=>prev.phase==='ready'?{...prev,
    message:'نتيجة الطلب غير مؤكدة. حدّث الطلبات أولًا؛ لا ترسل طلبًا ثانيًا.'}:prev);
  }finally{busyRef.current=false;setSending(false);}
 }
 const data=view.phase==='ready'?view.data:null;
 const pending=data?latestPendingAcademyRequest(data):null;
 return <section className={css.catalogSection} aria-label="باقات الأكاديمية">
  <div className={css.catalogHeader}><h2 className={css.sectionTitle}>الباقات المتاحة</h2>
   {(view.phase==='error'||uncertain)&&<button type="button" className={css.buttonOutline}
    onClick={()=>setRetry(n=>n+1)}>تحديث</button>}</div>
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
       disabled={sending||uncertain||!!pending}
       onClick={()=>void request(pkg)}>
       {sending?'جارٍ إرسال الطلب…':pending?'لديك طلب قيد المراجعة':'اطلب الباقة'}</button>
     </article>)}</div>}
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
 </section>;
}
