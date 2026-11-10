'use client';
import {useEffect,useRef,useState} from 'react';
import type {AccountSession} from '@/features/account';
import type {AdminDataRow} from './admin-collections-client';
import type {AdminTeacher} from './admin-teachers-client';
import {submitAdminAction,validAdminAction,AdminActionError,isAdminActionStaffRevoked,
 type AdminOperationKind,type AdminActionResult} from './admin-operations-client';
import css from './AdminOperations.module.css';

type Result=
 |{phase:'idle'|'sending'}
 |{phase:'done';value:AdminActionResult}
 |{phase:'error';message:string}
 |{phase:'uncertain';command:unknown;operationId:string};
type Props={kind:AdminOperationKind;session:AccountSession;
 rows?:readonly AdminDataRow[];teachers?:readonly AdminTeacher[];
 onApplied?:(result:AdminActionResult)=>void;onAccessRevoked?:()=>void};
type StaffOptions=Readonly<{
 students:readonly {id:string;name:string}[];
 sheikhs:readonly {id:string;name:string}[];
}>;
type SessionScoped<T>=Readonly<{session:AccountSession;kind:AdminOperationKind;value:T}>;
/** Never render prior staff data or an in-flight action under a new signed
 * session, even for the same account or before effect cleanup runs. */
export function adminOperationScopedValue<T>(
 entry:SessionScoped<T>|null,session:AccountSession,kind:AdminOperationKind,
):T|null{
 return entry?.session===session&&entry.kind===kind?entry.value:null;
}
/** A staff confirmation authorizes only the exact fields and session shown
 * when checked, never a later teacher/learner/action/reason selection. */
export function adminOperationConfirmationMatches<T>(
 confirmation:{session:T;fields:string}|null,session:T,fields:string,
):boolean{
 return confirmation!==null&&confirmation.session===session&&confirmation.fields===fields;
}
/** #314: a fresh signed exact-ID lookup can change a selected Sheikh's
 * qualification, active state or workload without changing the form inputs.
 * Consent must be bound to the verified facts the operator actually saw. */
export function adminOperationConfirmationScope(
 fields:readonly unknown[],kind:AdminOperationKind,
 teachers:readonly AdminTeacher[],selectedTeacherId:string,
):string{
 const selected=kind==='teacher'?teachers.find(t=>t.id===selectedTeacherId):undefined;
 return JSON.stringify([...fields,selected??null]);
}
/** #314: a removed or stale Sheikh selection is not an authorized roster target.
 * The server still reauthorizes every mutation, but the browser must not
 * offer a fresh confirmation for an actor absent from its signed roster. */
export function adminTeacherActionTargetIsVerified(
 kind:AdminOperationKind,action:string,teacherId:string,
 teachers:readonly AdminTeacher[],
):boolean{
 return kind!=='teacher'||action==='provision'||
  teachers.some(teacher=>teacher.id===teacherId);
}
/** #314: a React state update is not a synchronous submission lock. Two
 * submits before the next render must never create distinct operationIds.
 * Uncertain outcomes can only replay the same immutable command. */
export type AdminOperationFlight='idle'|'sending'|'uncertain'|'done';
export function claimAdminOperationFlight(
 lock:{current:AdminOperationFlight},retry=false,
):boolean{
 if(lock.current!==(retry?'uncertain':'idle'))return false;
 lock.current='sending';
 return true;
}
/** Clear the prior consent synchronously in the same input event, before
 * updating a controlled field. A rapid edit-and-revert must not reuse consent
 * if React batches field renders or effect cleanup is delayed. */
export function adminOperationEditField<T>(
 clearConsent:()=>void,setField:(value:T)=>void,value:T,
):void{
 clearConsent();
 setField(value);
}
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
/** A signed staff options GET 401/403 invalidates previously displayed
 * options. Missing routes and temporary errors are not role revocations. */
export function adminStaffOptionsError(status:number):AdminActionError{
 return new AdminActionError(status===401?'UNAUTHENTICATED':
  status===403?'STAFF_ACCESS_DENIED':'STAFF_OPTIONS_UNAVAILABLE',status);
}
export function AdminOperations({kind,session,rows=[],teachers=[],onApplied,onAccessRevoked}:Props){
 // On a new login or section, do not paint the previous staff actor's
 // editable learner/teacher IDs, reason or pending command even for one frame.
 const [bound,setBound]=useState<SessionScoped<true>>({session,kind,value:true});
 const active=adminOperationScopedValue(bound,session,kind)===true;
 const [action,setAction]=useState<string>(actions[kind][0]!.id);
 const [target,setTarget]=useState('');
 const [learner,setLearner]=useState('');
 const [teacher,setTeacher]=useState('');
 const [resource,setResource]=useState('');
 const [starts,setStarts]=useState('');
 const [ends,setEnds]=useState('');
 const [lessonKind,setLessonKind]=useState('trial');
 const [options,setOptions]=useState<SessionScoped<StaffOptions>|null>(null);
 const visibleOptions=adminOperationScopedValue(options,session,kind);
 const students=visibleOptions?.students??[];
 const sheikhs=visibleOptions?.sheikhs??[];
 const [reason,setReason]=useState('');
 const [confirmation,setConfirmation]=useState<{session:AccountSession;fields:string}|null>(null);
 const edit=(setter:(value:string)=>void,value:string)=>
  adminOperationEditField(()=>setConfirmation(null),setter,value);
 // Bind consent to all operator-editable fields, including the target and reason.
 // A changed field invalidates consent synchronously during render, before submit.
 const confirmationFields=adminOperationConfirmationScope(
  [kind,action,target,learner,teacher,resource,starts,ends,lessonKind,reason],
  kind,teachers,resource);
 const targetVerified=adminTeacherActionTargetIsVerified(kind,action,resource,teachers);
 const confirmed=targetVerified&&adminOperationConfirmationMatches(confirmation,session,confirmationFields);
 // Once any field changes, clear the original consent token. Restoring the
 // old text/target must not silently reactivate a previously checked box.
 useEffect(()=>{setConfirmation(null);},[confirmationFields,session]);
 const [resultState,setResultState]=useState<SessionScoped<Result>|null>(null);
 const result=adminOperationScopedValue(resultState,session,kind)??{phase:'idle' as const};
 const setResult=(value:Result)=>setResultState({session,kind,value});
 const current=useRef<AbortController|null>(null);
 const flight=useRef<AdminOperationFlight>('idle');
 const liveSession=useRef(session);liveSession.current=session;
 const liveKind=useRef(kind);liveKind.current=kind;
 useEffect(()=>{
  setAction(actions[kind][0]!.id);
  setTarget('');setLearner('');setTeacher('');setResource('');
  setStarts('');setEnds('');setLessonKind('trial');setReason('');
  setConfirmation(null);setOptions(null);setResultState(null);
  // Reveal the form only after all prior-session fields are cleared.
  setBound({session,kind,value:true});
  return ()=>{current.current?.abort();current.current=null;flight.current='idle';};
 },[session,kind]);
 useEffect(()=>{
  if(kind!=='schedule')return;
  const ctrl=new AbortController();
  async function options(path:string){
   const r=await fetch(path,{credentials:'same-origin',cache:'no-store',signal:ctrl.signal});
   if(!r.ok)throw adminStaffOptionsError(r.status);
   return r.json() as Promise<{rows?:{id:string;name:string}[];
    teachers?:{id:string;name:string;status:string;qualified:boolean}[]}>;
  }
  void Promise.all([
   options('/v1/staff/collections?view=students'),
   options('/v1/staff/teachers'),
  ]).then(([a,b])=>{
   if(ctrl.signal.aborted||liveSession.current!==session||liveKind.current!==kind)return;
   setOptions({session,kind,value:{
    students:(a.rows??[]).filter(x=>typeof x.id==='string'&&typeof x.name==='string'),
    sheikhs:(b.teachers??[]).filter(x=>x.status==='active'&&x.qualified),
   }});
  }).catch(error=>{
   if(ctrl.signal.aborted||liveSession.current!==session||liveKind.current!==kind)return;
   if(isAdminActionStaffRevoked(error)){
    setOptions(null);
    onAccessRevoked?.();
    return;
   }
   setOptions({session,kind,value:{students:[],sheikhs:[]}});
  });
  return()=>ctrl.abort();
 },[kind,session]);
 const busy=result.phase==='sending'||result.phase==='uncertain';
 function changeAction(v:string){
  if(busy)return;
  setAction(v);setResource('');setConfirmation(null);setResult({phase:'idle'});
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
   if(ctrl.signal.aborted||liveSession.current!==session||liveKind.current!==kind)return;
   flight.current='done';
   setResult({phase:'done',value:acknowledged});setConfirmation(null);onApplied?.(acknowledged);
  }catch(e){
   if(ctrl.signal.aborted||liveSession.current!==session||liveKind.current!==kind)return;
   if(e instanceof AdminActionError&&e.uncertain){
    flight.current='uncertain';
    setResult({phase:'uncertain',command:value,operationId});return;
   }
   flight.current='idle';
   // A signed mutation denial must also invalidate the already-visible staff
   // roster; business-rule 403, target 404 and transient 503 must not.
   if(isAdminActionStaffRevoked(e))onAccessRevoked?.();
   const code=e instanceof AdminActionError?e.code:'NETWORK_OUTCOME_UNKNOWN';
   setResult({phase:'error',message:errors[code]??('رفض الخادم العملية: '+code)});
  }finally{if(current.current===ctrl)current.current=null;}
 }
 function beginSend(value:unknown,operationId:string,retry=false){
  if(!claimAdminOperationFlight(flight,retry))return;
  void send(value,operationId);
 }
 function handleSubmit(){
  if(!active||flight.current!=='idle'||busy||!confirmed||!targetVerified)return;
  const operationId=crypto.randomUUID(),value=command(operationId);
  if(!validAdminAction(kind,value)){
   setResult({phase:'error',message:errors.INVALID_ACTION_INPUT??'راجع الحقول المطلوبة.'});return;
  }
  beginSend(value,operationId);
 }
 const choices=kind==='attendance'?rows.filter(r=>r.decision==='pending')
  :kind==='schedule'&&action==='cancel'?rows.filter(r=>r.status==='scheduled'):[];
 if(!active)return <section className={css.panel} role="status">
  جارٍ التحقق من جلسة الإدارة قبل عرض بيانات الإجراءات…
 </section>;
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
     value={target} onChange={e=>edit(setTarget,e.target.value)}/></label>}
   {kind==='teacher'&&action!=='provision'&&<label>اختر الشيخ من السجل الموثق
    <select required disabled={busy} value={resource} onChange={e=>edit(setResource,e.target.value)}>
     <option value="">اختر شيخًا…</option>
     {teachers.map(t=><option key={t.id} value={t.id}>
      {t.name} · {t.status==='active'?'نشط':'موقوف'} · {t.qualified?'مؤهل':'غير مؤهل'}
     </option>)}
    </select></label>}
   {kind==='schedule'&&['assign','book'].includes(action)&&<>
    <label>اختر الطالب
     {students.length>0&&<select disabled={busy} value={learner}
      onChange={e=>edit(setLearner,e.target.value)}>
      <option value="">اختر الطالب من سجلات الأكاديمية</option>
      {students.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
     </select>}
     <input required disabled={busy} maxLength={128} value={learner}
      aria-label="معرّف الطالب عند عدم ظهوره في السجل"
      onChange={e=>edit(setLearner,e.target.value)} placeholder="معرّف الطالب"/></label>
    <label>اختر الشيخ
     {sheikhs.length>0&&<select disabled={busy} value={teacher}
      onChange={e=>edit(setTeacher,e.target.value)}>
      <option value="">اختر الشيخ النشط</option>
      {sheikhs.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
     </select>}
     <input required disabled={busy} maxLength={128} value={teacher}
      aria-label="معرّف الشيخ عند عدم ظهوره في السجل"
      onChange={e=>edit(setTeacher,e.target.value)} placeholder="معرّف الشيخ"/></label>
    <label>بداية الموعد (بتوقيت جهازك)
     <input required disabled={busy} type="datetime-local" value={starts}
      onChange={e=>edit(setStarts,e.target.value)}/></label>
    {action==='assign'&&<label>نهاية الإسناد (بتوقيت جهازك)
     <input required disabled={busy} type="datetime-local" value={ends}
      onChange={e=>edit(setEnds,e.target.value)}/></label>}
    {action==='book'&&<label>نوع الحصة
     <select disabled={busy} value={lessonKind} onChange={e=>edit(setLessonKind,e.target.value)}>
      <option value="trial">تجريبية</option><option value="standard">عادية</option>
      <option value="makeup">تعويض</option>
     </select></label>}
   </>}
   {(kind==='attendance'||kind==='schedule'&&['revoke','cancel'].includes(action))&&
    <label>{kind==='attendance'?'معرّف الاعتراض':'معرّف الحصة أو الإسناد'}
     {choices.length>0&&<select disabled={busy} value={resource}
      onChange={e=>edit(setResource,e.target.value)}>
      <option value="">اختر من السجلات أو أدخل معرّفًا</option>
      {choices.map(r=><option key={r.id} value={String(r.id)}>
       {String(r.id)}</option>)}
     </select>}
     <input required disabled={busy} maxLength={128} autoComplete="off"
      value={resource} onChange={e=>edit(setResource,e.target.value)}/></label>}
   <label>سبب القرار (يُسجّل دائمًا)
    <textarea rows={3} required disabled={busy} maxLength={500} value={reason}
     onChange={e=>edit(setReason,e.target.value)}
     placeholder="اكتب سببًا واضحًا لا يقل عن عشرة أحرف"/></label>
   {kind==='teacher'&&action!=='provision'&&resource!==''&&!targetVerified&&
    <p role="alert" className={css.error}>لم يعد الشيخ المحدد موجودًا في السجل الموثق. حدّث السجل واختر الشيخ من جديد.</p>}
   <label className={css.check}>
    <input type="checkbox" checked={confirmed} disabled={busy||!targetVerified}
     onChange={e=>{
      // After an acknowledged write, require an entirely new user consent.
      // A double-click before React renders cannot release the flight lock.
      if(e.target.checked&&flight.current==='done')flight.current='idle';
      setConfirmation(e.target.checked?{session,fields:confirmationFields}:null);
     }}/>
    <span>راجعت الحساب والمعرّفات والسياسة وأؤكد التنفيذ على البيانات الحقيقية.</span>
   </label>
   <button disabled={!confirmed||busy||!targetVerified} type="submit">
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
   <button type="button" onClick={()=>beginSend(result.command,result.operationId,true)}>
    إعادة إرسال نفس العملية فقط</button>
  </div>}
  <p className={css.note}>لا يتم تغيير أي بيانات بالواجهة قبل تأكيد D1. لا يمكن
   تجاوز صلاحية الخادم أو تعديل الرصيد المالي بهذه الأداة.</p>
 </section>;
}
