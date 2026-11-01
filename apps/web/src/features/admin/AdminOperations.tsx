'use client';
import {useEffect,useRef,useState} from 'react';
import type {AccountSession} from '@/features/account';
import type {AdminDataRow} from './admin-collections-client';
import type {AdminTeacher} from './admin-teachers-client';
import {submitAdminAction,validAdminAction,AdminActionError,
 type AdminOperationKind,type AdminActionResult} from './admin-operations-client';
import css from './AdminOperations.module.css';

type Result=
 |{phase:'idle'|'sending'}
 |{phase:'done';value:AdminActionResult}
 |{phase:'error';message:string}
 |{phase:'uncertain';command:unknown;operationId:string};
type Props={kind:AdminOperationKind;session:AccountSession;
 rows?:readonly AdminDataRow[];teachers?:readonly AdminTeacher[];onApplied?:()=>void};
const actions:Record<AdminOperationKind,readonly {id:string;label:string}[]>={
 teacher:[
  {id:'provision',label:'تجهيز ملف شيخ غير نشط'},
  {id:'qualify',label:'اعتماد التأهيل'},
  {id:'activate',label:'تفعيل الشيخ'},
  {id:'suspend',label:'إيقاف الشيخ'},
  {id:'revoke_qualification',label:'سحب التأهيل'}],
 schedule:[
  {id:'assign',label:'إسناد شيخ لطالب'},
  {id:'revoke',label:'إلغاء إسناد'},
  {id:'cancel',label:'إلغاء حصة'}],
 attendance:[{id:'accepted',label:'قبول الاعتراض'},{id:'rejected',label:'رفض الاعتراض'}],
};
const titles:Record<AdminOperationKind,string>={
 teacher:'إجراءات الشيوخ',schedule:'إدارة الإسناد والحصص',
 attendance:'البتّ في اعتراض الحضور',
};
const notes:Record<AdminOperationKind,string>={
 teacher:'الهوية المطلوبة هي معرّف حساب المصادقة الموثق، وليست اسم الشيخ أو معرّف ملفه. لا يوجد إرسال دعوة تلقائي.',
 schedule:'تُطبّق عمليات الإسناد وإلغاؤه وإلغاء الحصص فقط بعد التحقق من D1. الحجز المدفوع أو اليدوي غير متاح هنا حتى تكتمل أهلية الرصيد.',
 attendance:'قرار الحضور يحتاج صلاحية attendance.review مستقلة. القرار لا يخصم رصيدًا ولا يصدر تعويضًا تلقائيًا.',
};
const errors:Record<string,string>={
 INVALID_ACTION_INPUT:'راجع الهوية أو المعرفات والوقت المستقبلي والسبب الواضح.',
 STAFF_ACCESS_DENIED:'هذا الحساب غير مصرّح له بتنفيذ العملية.',
 SCHEDULE_TRANSITION_DENIED:'قاعدة البيانات رفضت الحجز أو الإلغاء وفق السياسة والتعارضات.',
 TEACHER_ROLE_TRANSITION_DENIED:'لا تسمح حالة الشيخ الحالية بهذا التغيير.',
 ATTENDANCE_REVIEW_DENIED:'لا يمكن اعتماد قرار هذا الاعتراض.',
};
const toMillis=(s:string)=>s?new Date(s).getTime():NaN;
export function AdminOperations({kind,session,rows=[],teachers=[],onApplied}:Props){
 const [action,setAction]=useState<string>(actions[kind][0]!.id);
 const [target,setTarget]=useState('');
 const [learner,setLearner]=useState('');
 const [teacher,setTeacher]=useState('');
 const [resource,setResource]=useState('');
 const [starts,setStarts]=useState('');
 const [ends,setEnds]=useState('');
 const [lessonKind,setLessonKind]=useState('trial');
 const [reason,setReason]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [result,setResult]=useState<Result>({phase:'idle'});
 const current=useRef<AbortController|null>(null);
 useEffect(()=>()=>{current.current?.abort();current.current=null;},[session,kind]);
 const busy=result.phase==='sending'||result.phase==='uncertain';
 function changeAction(v:string){
  if(busy)return;
  setAction(v);setResource('');setConfirmed(false);setResult({phase:'idle'});
 }
 function command(operationId:string):unknown{
  const base={operationId,reason:reason.trim()};
  if(kind==='teacher')return action==='provision'
   ?{...base,action,targetUserId:target.trim()}
   :{...base,action,teacherId:resource.trim()};
  if(kind==='attendance')return {...base,appealId:resource.trim(),decision:action};
  if(action==='cancel'||action==='revoke')return {...base,action,resourceId:resource.trim()};
  const common={...base,action,learnerId:learner.trim(),teacherId:teacher.trim(),
   startsAtMs:toMillis(starts)};
  if(action==='assign')return {...common,endsAtMs:toMillis(ends)};
  return {...common,kind:lessonKind};
 }
 async function send(value:unknown,operationId:string){
  current.current?.abort();
  const ctrl=new AbortController();current.current=ctrl;
  setResult({phase:'sending'});
  try{
   const acknowledged=await submitAdminAction(kind,value,ctrl.signal);
   if(ctrl.signal.aborted)return;
   setResult({phase:'done',value:acknowledged});setConfirmed(false);onApplied?.();
  }catch(e){
   if(ctrl.signal.aborted)return;
   if(e instanceof AdminActionError&&e.uncertain){
    setResult({phase:'uncertain',command:value,operationId});return;
   }
   const code=e instanceof AdminActionError?e.code:'NETWORK_OUTCOME_UNKNOWN';
   setResult({phase:'error',message:errors[code]??('رفض الخادم العملية: '+code)});
  }finally{if(current.current===ctrl)current.current=null;}
 }
 function handleSubmit(){
  if(busy||!confirmed)return;
  const operationId=crypto.randomUUID(),value=command(operationId);
  if(!validAdminAction(kind,value)){
   setResult({phase:'error',message:errors.INVALID_ACTION_INPUT});return;
  }
  void send(value,operationId);
 }
 const choices=kind==='attendance'?rows.filter(r=>r.decision==='pending')
  :kind==='schedule'&&action==='cancel'?rows.filter(r=>r.status==='scheduled'):[];
 return <section className={css.panel} aria-label={titles[kind]}>
  <header className={css.header}>
   <div><small>إجراءات مؤمّنة · سجل تدقيق D1</small><h2>{titles[kind]}</h2></div>
  </header>
  <p>{notes[kind]}</p>
  <form className={css.form} onSubmit={e=>{e.preventDefault();handleSubmit();}}>
   <label>الإجراء
    <select disabled={busy} value={action} onChange={e=>changeAction(e.target.value)}>
     {actions[kind].map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
    </select></label>
   {kind==='teacher'&&action==='provision'&&<label>معرّف الحساب المسجّل (auth subject)
    <input required disabled={busy} maxLength={128} autoComplete="off"
     value={target} onChange={e=>setTarget(e.target.value)}/></label>}
   {kind==='teacher'&&action!=='provision'&&<label>اختر الشيخ من السجل الموثق
    <select required disabled={busy} value={resource} onChange={e=>setResource(e.target.value)}>
     <option value="">اختر شيخًا…</option>
     {teachers.map(t=><option key={t.id} value={t.id}>
      {t.name} · {t.status==='active'?'نشط':'موقوف'} · {t.qualified?'مؤهل':'غير مؤهل'}
     </option>)}
    </select></label>}
   {kind==='schedule'&&['assign','book'].includes(action)&&<>
    <label>معرّف الطالب
     <input required disabled={busy} maxLength={128} value={learner}
      onChange={e=>setLearner(e.target.value)}/></label>
    <label>معرّف ملف الشيخ
     <input required disabled={busy} maxLength={128} value={teacher}
      onChange={e=>setTeacher(e.target.value)}/></label>
    <label>بداية الموعد (بتوقيت جهازك)
     <input required disabled={busy} type="datetime-local" value={starts}
      onChange={e=>setStarts(e.target.value)}/></label>
    {action==='assign'&&<label>نهاية الإسناد (بتوقيت جهازك)
     <input required disabled={busy} type="datetime-local" value={ends}
      onChange={e=>setEnds(e.target.value)}/></label>}
    {action==='book'&&<label>نوع الحصة
     <select disabled={busy} value={lessonKind} onChange={e=>setLessonKind(e.target.value)}>
      <option value="trial">تجريبية</option><option value="standard">عادية</option>
      <option value="makeup">تعويض</option>
     </select></label>}
   </>}
   {(kind==='attendance'||kind==='schedule'&&['revoke','cancel'].includes(action))&&
    <label>{kind==='attendance'?'معرّف الاعتراض':'معرّف الحصة أو الإسناد'}
     {choices.length>0&&<select disabled={busy} value={resource}
      onChange={e=>setResource(e.target.value)}>
      <option value="">اختر من السجلات أو أدخل معرّفًا</option>
      {choices.map(r=><option key={r.id} value={String(r.id)}>
       {String(r.id)}</option>)}
     </select>}
     <input required disabled={busy} maxLength={128} autoComplete="off"
      value={resource} onChange={e=>setResource(e.target.value)}/></label>}
   <label>سبب القرار (يُسجّل دائمًا)
    <textarea rows={3} required disabled={busy} maxLength={500} value={reason}
     onChange={e=>setReason(e.target.value)}
     placeholder="اكتب سببًا واضحًا لا يقل عن عشرة أحرف"/></label>
   <label className={css.check}>
    <input type="checkbox" checked={confirmed} disabled={busy}
     onChange={e=>setConfirmed(e.target.checked)}/>
    <span>راجعت الحساب والمعرّفات والسياسة وأؤكد التنفيذ على البيانات الحقيقية.</span>
   </label>
   <button disabled={!confirmed||busy} type="submit">
    {result.phase==='sending'?'جارٍ تأكيد الحفظ…':'تنفيذ الإجراء وتسجيله'}</button>
  </form>
  {result.phase==='error'&&<p role="alert" className={css.error}>{result.message}</p>}
  {result.phase==='done'&&<p role="status" className={css.ok}>
   أكّد الخادم التسجيل: {result.value.code} {result.value.resourceId??''}
  </p>}
  {result.phase==='uncertain'&&<div role="alert" className={css.warning}>
   <strong>لا يمكن الجزم بنتيجة الاتصال</strong>
   <p>ربما سُجّل الإجراء بالفعل. لا ترسل معرّفًا جديدًا لنفس القرار.</p>
   <code>{result.operationId}</code>
   <button type="button" onClick={()=>void send(result.command,result.operationId)}>
    إعادة إرسال نفس العملية فقط</button>
  </div>}
  <p className={css.note}>لا يتم تغيير أي بيانات بالواجهة قبل تأكيد D1. لا يمكن
   تجاوز صلاحية الخادم أو تعديل الرصيد المالي بهذه الأداة.</p>
 </section>;
}
