'use client';
import {useEffect,useState} from 'react';
import type {AccountSession} from '@/features/account';
import styles from './AdminAcademyMvp.module.css';
type Trial={requestId:string;learnerName:string;startsAtMs:number;teacherName:string;state:string};
type Cycle={cycleId:string;learnerId:string;learnerName:string;startsAtMs:number;endsAtMs:number;remaining:number};
type Teacher={id:string;name:string;status:string;qualified:boolean};
type ReadState={phase:'loading'|'ready'|'error';trials:Trial[];cycles:Cycle[];teachers:Teacher[]};
const date=new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',
 dateStyle:'medium',timeStyle:'short'});
export function AdminBookingPanel({mode,session}:{mode:'trial'|'paid';session:AccountSession}){
 const [data,setData]=useState<ReadState>({phase:'loading',trials:[],cycles:[],teachers:[]});
 const [retry,setRetry]=useState(0);
 const [target,setTarget]=useState('');
 const [teacher,setTeacher]=useState('');
 const [start,setStart]=useState('');
 const [reason,setReason]=useState('');
 const [approve,setApprove]=useState(true);
 const [confirmed,setConfirmed]=useState(false);
 const [result,setResult]=useState('');
 const [pending,setPending]=useState<{path:string;body:unknown}|null>(null);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  const ctrl=new AbortController();
  setData({phase:'loading',trials:[],cycles:[],teachers:[]});
  const root='/v1/staff/academy/';
  const paths=mode==='trial'?['trials']:['cycles'];
  void Promise.all([...paths.map(async p=>{
   const r=await fetch(root+p,{credentials:'same-origin',cache:'no-store',signal:ctrl.signal});
   if(!r.ok)throw Error('DENIED');
   return r.json() as Promise<{requests?:Trial[];cycles?:Cycle[]}>;
  }),...([fetch('/v1/staff/teachers',{
    credentials:'same-origin',cache:'no-store',signal:ctrl.signal
   }).then(async r=>{if(!r.ok)throw Error('DENIED');
    return r.json() as Promise<{teachers:Teacher[]}>;})])).then(list=>{
   const first=list[0] as {requests?:Trial[];cycles?:Cycle[]}|undefined;
   const second=list[1] as {teachers?:Teacher[]}|undefined;
   if(!ctrl.signal.aborted)setData({phase:'ready',trials:first?.requests??[],
    cycles:first?.cycles??[],teachers:second?.teachers??[]});
  }).catch(()=>{if(!ctrl.signal.aborted)setData({phase:'error',
   trials:[],cycles:[],teachers:[]});});
  return()=>ctrl.abort();
 },[mode,session,retry]);
 async function send(path:string,body:unknown){
  setBusy(true);setResult('جارٍ تسجيل القرار لدى الخادم…');setPending({path,body});
  try{
   const response=await fetch(path==='slot-publication'?'/v1/staff/trial-slots':
    '/v1/staff/academy/'+path,{
    method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const payload:unknown=await response.json();
   if(!payload||typeof payload!=='object'||Array.isArray(payload)||
    typeof (payload as {code?:unknown}).code!=='string')throw Error('NETWORK_UNKNOWN');
   const code=(payload as {code:string}).code;
   if(!response.ok)throw Error(code);
   setResult('تم تسجيل العملية على D1: '+code);setPending(null);
   setConfirmed(false);setReason('');setRetry(n=>n+1);
  }catch(e){setResult('النتيجة غير مؤكدة: '+(e instanceof Error?e.message:'اتصال غير مؤكد')+
   '. عند إعادة المحاولة يجب استخدام نفس المعرف.');}
  finally{setBusy(false);}
 }
 const selectedCycle=data.cycles.find(x=>x.cycleId===target);
 return <section className={styles.root} dir="rtl" aria-label={mode==='trial'?'تأكيد تجربة الطالب':'حجز حصص الباقة'}>
  <h2>{mode==='trial'?'طلبات تأكيد الحصة التجريبية':'حجز حصة من باقة مفعّلة'}</h2>
  {data.phase==='loading'&&<p>جارٍ قراءة الطلبات من D1…</p>}
  {data.phase==='error'&&<p role="alert">تعذّر التحقق من الصلاحية أو السجلات.</p>}
  {data.phase==='ready'&&<>
   {mode==='trial'?<>
    <form onSubmit={e=>{e.preventDefault();
     if(!confirmed||!teacher||!start||busy)return;
     void send('slot-publication',{operationId:crypto.randomUUID(),
      teacherId:teacher,startsAtMs:new Date(start).getTime()});
    }}>
     <h3>نشر موعد تجريبي متاح</h3>
     <p>اختاري الشيخ والوقت؛ سيظهر الموعد للطالب كي يطلب تأكيده من الإدارة.
      نشر الموعد لا يحجز حصة ولا يخصم رصيدًا.</p>
     <label>الشيخ
      <select required value={teacher} onChange={e=>setTeacher(e.target.value)}>
       <option value="">اختر شيخًا نشطًا</option>
       {data.teachers.filter(t=>t.status==='active'&&t.qualified).map(t=>
        <option key={t.id} value={t.id}>{t.name}</option>)}
      </select></label>
     <label>الموعد<input required type="datetime-local" value={start}
      onChange={e=>setStart(e.target.value)}/></label>
     <label><input type="checkbox" checked={confirmed}
      onChange={e=>setConfirmed(e.target.checked)}/>
      راجعت توافر الشيخ وأوافق على إظهار الموعد للطلاب</label>
     <button type="submit" disabled={!teacher||!start||!confirmed||busy}>نشر الموعد التجريبي</button>
    </form>
    {data.trials.length===0?<p>مفيش طلبات تجريبية حالياً.</p>:
     <div className={styles.options}>
     {data.trials.map(v=><label key={v.requestId}>
      <input type="radio" name="trial" checked={v.requestId===target}
       onChange={()=>{setTarget(v.requestId);setConfirmed(false);}}/>
      {v.learnerName} · {v.teacherName} · {date.format(new Date(v.startsAtMs))}
      {' · '}{v.state==='pending'?'بانتظار الموافقة':v.state}
     </label>)}
     </div>}
    <label><input type="checkbox" checked={approve}
     onChange={e=>setApprove(e.target.checked)}/>الموافقة على الموعد</label>
   </>:<>
    <label>الباقة المفعّلة للطالب<select value={target}
     onChange={e=>{setTarget(e.target.value);setConfirmed(false);}}>
     <option value="">اختر الطالب ودورة الاشتراك</option>
     {data.cycles.filter(c=>c.remaining>0).map(c=><option key={c.cycleId} value={c.cycleId}>
      {c.learnerName} — {c.remaining} حصص / حتى {date.format(new Date(c.endsAtMs))}
     </option>)}
    </select></label>
    <label>الشيخ المرتبط بالطالب<select value={teacher}
     onChange={e=>{setTeacher(e.target.value);setConfirmed(false);}}>
     <option value="">اختر الشيخ</option>
     {data.teachers.filter(t=>t.status==='active'&&t.qualified).map(t=>
      <option key={t.id} value={t.id}>{t.name}</option>)}
    </select></label>
    <label>الموعد<input type="datetime-local" value={start}
     onChange={e=>{setStart(e.target.value);setConfirmed(false);}}/></label>
    {selectedCycle&&<p>الطالب: {selectedCycle.learnerName}. الحجز يستقطع حصة واحدة
     في نفس عملية D1، ولا يتم إلا مع شيخ مرتبط بهذا الطالب وموعد متاح.</p>}
   </>}
   <label>سبب القرار / ملاحظة الحجز<input required minLength={8} maxLength={500}
    value={reason} onChange={e=>setReason(e.target.value)}
    placeholder="تم التأكد من الموعد مع الأسرة والشيخ"/></label>
   <label><input type="checkbox" checked={confirmed}
    onChange={e=>setConfirmed(e.target.checked)}/>
    أؤكد الموافقة بعد مراجعة الطالب والموعد، وأتحمل مسؤولية القرار الإداري.</label>
   <button type="button" disabled={!confirmed||busy||reason.trim().length<8||!target||
    (mode==='paid'&&(!teacher||!start||!selectedCycle))}
    onClick={()=>{
     const operationId=crypto.randomUUID();
     if(mode==='trial')void send('trial-decisions',{
      operationId,requestId:target,decision:approve?'approved':'rejected',reason:reason.trim()});
     else if(selectedCycle)void send('book',{
      operationId,learnerId:selectedCycle.learnerId,cycleId:target,teacherId:teacher,
      startsAtMs:new Date(start).getTime(),reason:reason.trim()});
    }}>
    {mode==='trial'?approve?'تأكيد التجربة':'رفض الطلب':'حجز وخصم حصة من الرصيد'}</button>
   <button type="button" disabled={busy} onClick={()=>setRetry(n=>n+1)}>تحديث</button>
   {result&&<p role="status">{result}</p>}
   {pending&&<button type="button" disabled={busy}
    onClick={()=>void send(pending.path,pending.body)}>إعادة نفس العملية بمعرّفها الأصلي</button>}
  </>}
 </section>;
}
