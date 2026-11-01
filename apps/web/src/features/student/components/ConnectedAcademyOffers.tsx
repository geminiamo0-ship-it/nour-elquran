'use client';
import {useEffect,useState} from 'react';
import styles from '../StudentPortal.module.css';
type Offer={versionId:string;packageId:string;title:string;priceEgp:number;sessions:number};
type Application={id:string;title:string;priceEgp:number;sessions:number;atMs:number;state:string};
type Data={code:string;packages:Offer[];requests:Application[];whatsappNumber:string|null};
type State={phase:'loading'|'error'|'ready'|'sending';value:Data|null;message:string};
async function get(learnerId:string,signal:AbortSignal):Promise<Data>{
 const r=await fetch('/v1/me/learners/'+learnerId+'/academy',{
  credentials:'same-origin',cache:'no-store',redirect:'error',signal});
 const d:unknown=await r.json();
 if(!r.ok||!d||typeof d!=='object'||Array.isArray(d)||
   (d as Data).code!=='ACADEMY_OWNER'||!Array.isArray((d as Data).packages)||
   !Array.isArray((d as Data).requests))throw new Error('تعذّر التحقق من الباقات');
 return d as Data;
}
const stateTitle:Record<string,string>={pending:'في انتظار موافقة الإدارة',
 activated:'تم تفعيل الاشتراك يدويًا',rejected:'لم تتم الموافقة على الطلب'};
export function ConnectedAcademyOffers({learnerId}:{learnerId:string}){
 const [state,setState]=useState<State>({phase:'loading',value:null,message:''});
 const [retry,setRetry]=useState(0);
 const [busyPackage,setBusyPackage]=useState<string|null>(null);
 useEffect(()=>{
  const ctrl=new AbortController();setState({phase:'loading',value:null,message:''});
  void get(learnerId,ctrl.signal).then(v=>{
   if(!ctrl.signal.aborted)setState({phase:'ready',value:v,message:''});
  }).catch(e=>{if(!ctrl.signal.aborted)setState({phase:'error',value:null,
   message:e instanceof Error?e.message:'تعذّر قراءة البيانات'});});
  return()=>ctrl.abort();
 },[learnerId,retry]);
 async function request(pkg:Offer){
  if(state.phase!=='ready'||busyPackage)return;
  setBusyPackage(pkg.packageId);
  // Never grant credits or show a payment receipt from a browser action.
  const operationId=crypto.randomUUID();
  try{
   const response=await fetch('/v1/me/learners/'+learnerId+'/academy',{
    method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({operationId,packageId:pkg.packageId})});
   const value:unknown=await response.json();
   if(!response.ok||!value||typeof value!=='object'||Array.isArray(value)||
    !['ACADEMY_REQUEST_CREATED','ACADEMY_REQUEST_REPLAY'].includes(
     String((value as {code?:unknown}).code)))throw new Error('تعذّر إرسال الطلب للخادم');
   setRetry(n=>n+1);
  }catch{
   setState(prev=>({...prev,message:
    'لا يمكن تأكيد نتيجة الإرسال. حدّث الطلبات أولًا قبل محاولة جديدة.'}));
  }finally{setBusyPackage(null);}
 }
 const v=state.value;
 return <section className={styles.panel} dir="rtl" aria-label="باقات نور القرآن وطلبات الاشتراك">
  <div className={styles.panelHead}><div>
   <p className={styles.eyebrow}>اشتراك الطالب · باقات حقيقية</p>
   <h2>اختيار باقة وطلب التفعيل</h2></div>
   <button type="button" className={styles.outlineButton}
    onClick={()=>setRetry(n=>n+1)}>تحديث</button></div>
  <p>اختار الباقة، ثم الإدارة هتراجع الطلب. لإتمام الدفع تواصل
   عبر واتساب؛ لن يبدأ اشتراكك لمجرد فتح واتساب أو إرسال الطلب.</p>
  {state.phase==='loading'&&<p role="status">جارٍ تحميل الباقات من الأكاديمية…</p>}
  {state.phase==='error'&&<p role="alert">{state.message}</p>}
  {state.message&&state.phase==='ready'&&<p role="alert">{state.message}</p>}
  {v&&<>
   {v.packages.length===0?<p className={styles.emptyBox}>الباقات لم تُفعّل من الإدارة بعد.</p>:
    <div className={styles.metricGrid}>
    {v.packages.map(pkg=><article key={pkg.versionId} className={styles.metric}>
     <strong>{pkg.title}</strong>
     <span>{pkg.priceEgp.toLocaleString('ar-EG')} جنيه</span>
     <small>{pkg.sessions.toLocaleString('ar-EG')} حصص / شهر</small>
     <button type="button" className={styles.outlineButton}
      disabled={busyPackage!==null||v.requests.some(r=>r.state==='pending')}
      onClick={()=>void request(pkg)}>
      {busyPackage===pkg.packageId?'جارٍ إرسال الطلب…':'طلب الباقة'}
     </button>
     {v.whatsappNumber&&<a className={styles.outlineButton}
      target="_blank" rel="noopener noreferrer"
      href={'https://wa.me/'+v.whatsappNumber+'?text='+encodeURIComponent(
       'السلام عليكم، أريد استكمال دفع باقة '+pkg.title+
       ' لملف الطالب '+learnerId+' بقيمة '+pkg.priceEgp+' جنيه.')}>
       استكمال الدفع عبر واتساب</a>}
    </article>)}
    </div>}
   <h3>طلباتي</h3>
   {v.requests.length===0?<p>لا توجد طلبات سابقة لهذا الطالب.</p>:
    <div className={styles.metricGrid}>
     {v.requests.map(req=><article key={req.id} className={styles.metric}>
      <strong>{req.title}</strong>
      <small>{req.priceEgp.toLocaleString('ar-EG')} جنيه</small>
      <span>{stateTitle[req.state]??'قيد المراجعة'}</span>
     </article>)}
    </div>}
   {!v.whatsappNumber&&<p>لم تضبط الأكاديمية رقم واتساب الدفع بعد؛ يمكنك إرسال الطلب للإدارة.</p>}
  </>}
 </section>;
}
