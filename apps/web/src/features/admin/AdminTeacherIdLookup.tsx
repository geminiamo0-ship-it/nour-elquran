'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {AccountSession} from '@/features/account';
import {fetchAdminTeachers,isAdminTeacherAccessRevoked,type AdminTeacher} from './admin-teachers-client';
import css from './AdminPortal.module.css';

type LookupPhase='idle'|'loading'|'found'|'missing'|'invalid'|'denied'|'error';
const validId=/^[a-zA-Z0-9-]{1,128}$/;

/** A new signed session can render before the old lookup effect is cleaned up.
 * A late response must never add a Sheikh to, or revoke, the new actor's UI. */
export function adminTeacherLookupMayApply<T>(
 startedSession:T,currentSession:T,aborted:boolean):boolean{
 return !aborted&&startedSession===currentSession;
}

/** A stalled signed lookup must be cancellable without accepting its late
 * response. Clearing the request ref permits an explicit fresh attempt. */
export function cancelAdminTeacherLookup(
 request:{current:AbortController|null},onCancelled:()=>void,
):void{
 request.current?.abort();
 request.current=null;
 onCancelled();
}

/** The cancel control disappears after loading; restore keyboard focus only
 * after React has enabled the input again, never during a session change. */
export function restoreCancelledAdminTeacherLookupFocus(
 pending:{current:boolean},ready:boolean,focus:()=>void,
):void{
 if(!pending.current||!ready)return;
 pending.current=false;
 focus();
}

/** #314: bounded, signed exact-ID fallback for a Sheikh omitted by the first 50 rows. */
export function AdminTeacherIdLookup({session,onFound,onMissing,onAccessRevoked}:{
 session:AccountSession;onFound:(teacher:AdminTeacher)=>void;
 onMissing:(teacherId:string)=>void;onAccessRevoked:()=>void;
}){
 const [boundSession,setBoundSession]=useState(session);
 const [id,setId]=useState('');
 const [phase,setPhase]=useState<LookupPhase>('idle');
 const current=useRef<AbortController|null>(null);
 const inputRef=useRef<HTMLInputElement|null>(null);
 const focusAfterCancel=useRef(false);
 const currentSession=useRef(session);
 currentSession.current=session;
 useEffect(()=>{
  current.current?.abort();
  focusAfterCancel.current=false;
  setBoundSession(session);setId('');setPhase('idle');
  return ()=>current.current?.abort();
 },[session]);
 const active=boundSession===session;
 useEffect(()=>{
  restoreCancelledAdminTeacherLookupFocus(focusAfterCancel,
   active&&phase==='idle',()=>inputRef.current?.focus());
 },[active,phase]);
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!active||phase==='loading')return;
  const teacherId=id.trim();
  if(!validId.test(teacherId)){setPhase('invalid');return;}
  current.current?.abort();
  const ctrl=new AbortController();current.current=ctrl;
  const startedSession=session;
  setPhase('loading');
  void fetchAdminTeachers(ctrl.signal,teacherId).then(result=>{
   if(!adminTeacherLookupMayApply(startedSession,currentSession.current,ctrl.signal.aborted))return;
   const teacher=result.teachers[0];
   if(!teacher){onMissing(teacherId);setPhase('missing');return;}
   onFound(teacher);setPhase('found');
  }).catch(error=>{
   if(!adminTeacherLookupMayApply(startedSession,currentSession.current,ctrl.signal.aborted))return;
   if(isAdminTeacherAccessRevoked(error)){
    // A fresh signed 401/403/404 invalidates the parent roster and actions.
    // Keeping an earlier successful list visible after revocation is unsafe.
    onAccessRevoked();setPhase('denied');return;
   }
   setPhase('error');
  });
 }
 return <section className={css.staffLookup} aria-label="إظهار شيخ خارج أول خمسين سجلًا">
  <form className={css.staffLookupForm} onSubmit={submit}>
   <label htmlFor="admin-exact-teacher-id">شيخ غير ظاهر؟ أدخل معرّف ملفه من سجل الدعوة أو الإدارة</label>
   <div className={css.staffLookupControls}>
    <input ref={inputRef} id="admin-exact-teacher-id" type="text" autoComplete="off"
     maxLength={128} required pattern="[a-zA-Z0-9-]{1,128}"
     dir="ltr" value={active?id:''} disabled={!active||phase==='loading'}
     onChange={e=>{setId(e.target.value);setPhase('idle');}}
     placeholder="Teacher ID" aria-describedby="admin-exact-teacher-help"/>
    <button type="submit" className={css.staffRefresh}
     disabled={!active||phase==='loading'}>
     {phase==='loading'?'جارٍ التحقق…':'إظهار الشيخ'}
    </button>
    {active&&phase==='loading'&&<button type="button" className={css.staffRefresh}
     onClick={()=>cancelAdminTeacherLookup(current,()=>{
      focusAfterCancel.current=true;
      setPhase('idle');
     })}>
     إلغاء البحث
    </button>}
   </div>
   <small id="admin-exact-teacher-help">بحث مطابق للمعرّف فقط، لا يعرض أرقام الهواتف أو بيانات الطلاب.</small>
  </form>
  {active&&phase==='found'&&<p role="status">تم التحقق من الشيخ وإضافته إلى خيارات الإجراءات.</p>}
  {active&&phase==='missing'&&<p role="status">لا يوجد ملف شيخ مطابق لهذا المعرّف.</p>}
  {active&&phase==='invalid'&&<p role="alert">أدخل معرّفًا صحيحًا بدون مسافات أو رموز إضافية.</p>}
  {active&&phase==='denied'&&<p role="alert">انتهت صلاحية الوصول إلى الدليل. أعد التحقق من جلسة الإدارة.</p>}
  {active&&phase==='error'&&<p role="alert">تعذّر تأكيد نتيجة البحث؛ لم نُضف أي سجل غير موثق.</p>}
 </section>;
}
