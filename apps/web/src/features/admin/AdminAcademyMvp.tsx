'use client';
import {useEffect,useState,type FormEvent} from 'react';
import type {AccountSession} from '@/features/account';
import styles from './AdminAcademyMvp.module.css';

type Package={id:string;packageId:string;title:string;priceEgp:number;sessions:number;active:number};
type Request={id:string;learnerId:string;learnerName:string;title:string;priceEgp:number;
 sessions:number;packageVersionId:string;state:string};
type Invite={id:string;teacherName:string|null;claimedSubject:string|null;
 teacherId:string|null;expiresAtMs:number};
type Academy={code:string;packages:Package[];requests:Request[];invites:Invite[];
 whatsappNumber:string|null};
type Result={phase:'idle'|'busy'|'done'|'error'|'uncertain';message:string};
type Mode='packages'|'requests'|'invites'|'contact';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const iso=()=>crypto.randomUUID();
const date=new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',dateStyle:'medium'});
function label(v:number){return v.toLocaleString('ar-EG');}
async function readAcademy(signal:AbortSignal):Promise<Academy>{
 const res=await fetch('/v1/staff/academy',{credentials:'same-origin',cache:'no-store',
  redirect:'error',signal});
 const v:unknown=await res.json();
 if(!res.ok||!v||typeof v!=='object'||Array.isArray(v)||
  (v as Academy).code!=='ACADEMY_STAFF'||!Array.isArray((v as Academy).packages)||
  !Array.isArray((v as Academy).requests)||!Array.isArray((v as Academy).invites))
  throw new Error('تعذّر قراءة الإدارة من الخادم');
 return v as Academy;
}
async function submit(path:string,command:unknown){
 const res=await fetch('/v1/staff/academy/'+path,{method:'POST',
  credentials:'same-origin',cache:'no-store',redirect:'error',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(command)});
 const v:unknown=await res.json();
 if(!v||typeof v!=='object'||Array.isArray(v)||typeof (v as {code?:unknown}).code!=='string')
  throw new Error('استجابة غير صالحة');
 const code=(v as {code:string}).code;
 if(!res.ok)throw new Error(code);
 return {code,...(v as object)};
}
/** Operations never optimistically claim a payment or an activation. */
export function AdminAcademyMvp({session,mode}:{session:AccountSession;mode:Mode}){
 const [data,setData]=useState<Academy|null>(null);
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
 const [pendingOp,setPendingOp]=useState<{path:string;payload:unknown}|null>(null);
 useEffect(()=>{
  const ctrl=new AbortController();
  setData(null);setResult({phase:'idle',message:''});setInviteUrl('');
  void readAcademy(ctrl.signal).then(v=>{
   if(!ctrl.signal.aborted){setData(v);setWhatsapp(v.whatsappNumber??'');}
  }).catch(e=>{if(!ctrl.signal.aborted)setResult({phase:'error',
   message:e instanceof Error?e.message:'تعذّر تحميل البيانات'});});
  return()=>ctrl.abort();
 },[session,refresh]);
 const busy=result.phase==='busy';
 async function send(path:string,payload:unknown){
  setResult({phase:'busy',message:'جارٍ تسجيل العملية لدى الخادم…'});
  setPendingOp({path,payload});
  try{
   const ack=await submit(path,payload);
   setResult({phase:'done',message:'سجّل الخادم العملية: '+ack.code});
   setConfirmed(false);setReason('');setPendingOp(null);
   if(path==='invites'&&typeof (ack as {token?:unknown}).token==='string'){
    const token=(ack as {token:string}).token;
    setInviteUrl(window.location.origin+'/teacher/join?token='+token);
   }else{setRefresh(n=>n+1);}
  }catch(e){
   setResult({phase:'uncertain',message:
    e instanceof Error?e.message:'نتيجة العملية غير معروفة؛ لا تُكررها بمعرّف جديد.'});
  }
 }
 function guard(event:FormEvent,action:()=>void){
  event.preventDefault();if(!confirmed||busy||!data)return;action();
 }
 const modeTitle={packages:'الباقات والأسعار',requests:'طلبات الاشتراك وتفعيل الطلاب',
  invites:'إضافة شيخ بدعوة',contact:'واتساب الأكاديمية'}[mode];
 return <section dir="rtl" className={styles.root} aria-label={modeTitle}>
  <h2>{modeTitle}</h2>
  <p>كل تعديل يتطلب صلاحية الإدارة الحالية وتأكيدًا صريحًا. الدفع لا يُثبت تلقائيًا من واتساب.</p>
  <button type="button" onClick={()=>setRefresh(n=>n+1)} disabled={busy}>
   تحديث البيانات</button>
  {!data&&<p role="status">جارٍ تحميل البيانات المصرح بها…</p>}
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
     <input type="radio" name="req" checked={selectedRequest===r.id}
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
     {data.packages.filter(p=>p.active===1).map(p=><option key={p.id} value={p.id}>
      {p.title} — {p.priceEgp} ج / {p.sessions} حصص</option>)}
    </select></label>
    <label>سبب/مرجع تأكيد الدفع<input required minLength={10} maxLength={500}
     value={reason} onChange={e=>setReason(e.target.value)}
     placeholder="تم الاستلام يدويًا بعد التحقق من التحويل"/></label>
    <Confirm checked={confirmed} onChange={setConfirmed}/>
    <button type="submit" disabled={!confirmed||busy||!UUID.test(learnerId)||!UUID.test(selectedPackage)}>
     تأكيد الاستلام وتفعيل الاشتراك</button>
    {selectedRequest&&<button type="button" disabled={!confirmed||busy}
     onClick={()=>void send('reject',{operationId:iso(),requestId:selectedRequest,
      reason:reason.trim()})}>رفض الطلب مع تسجيل السبب</button>}
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
    {' '}{i.claimedSubject?'تم تسجيل حساب الشيخ':'بانتظار التسجيل'}
    {i.teacherId?' · موجود في دليل الشيوخ':''}
    {' · انتهاء: '}{date.format(new Date(i.expiresAtMs))}
    {i.claimedSubject&&!i.teacherId&&<p>
     الحساب جاهز للاعتماد الإداري بعد التحقق من هويته؛ معرّفه:
     <code dir="ltr">{i.claimedSubject}</code></p>}
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
  {result.phase==='uncertain'&&pendingOp&&<button type="button"
   onClick={()=>void send(pendingOp.path,pendingOp.payload)}>إعادة نفس العملية بمعرّفها الأصلي</button>}
 </section>;
}
function Confirm({checked,onChange}:{checked:boolean;onChange:(x:boolean)=>void}){
 return <label><input type="checkbox" checked={checked}
  onChange={e=>onChange(e.target.checked)}/>
  أؤكد أني راجعت بيانات العملية وأنفذها بصفتي مسؤولًا مفوضًا</label>;
}
