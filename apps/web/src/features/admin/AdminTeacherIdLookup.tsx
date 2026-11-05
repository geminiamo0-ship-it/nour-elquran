'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {AccountSession} from '@/features/account';
import {AdminTeachersError,fetchAdminTeachers,type AdminTeacher} from './admin-teachers-client';
import css from './AdminPortal.module.css';

type LookupPhase='idle'|'loading'|'found'|'missing'|'invalid'|'denied'|'error';
const validId=/^[a-zA-Z0-9-]{1,128}$/;

/** #314: bounded, signed exact-ID fallback for a Sheikh omitted by the first 50 rows. */
export function AdminTeacherIdLookup({session,onFound}:{
 session:AccountSession;onFound:(teacher:AdminTeacher)=>void;
}){
 const [boundSession,setBoundSession]=useState(session);
 const [id,setId]=useState('');
 const [phase,setPhase]=useState<LookupPhase>('idle');
 const current=useRef<AbortController|null>(null);
 useEffect(()=>{
  current.current?.abort();
  setBoundSession(session);setId('');setPhase('idle');
  return ()=>current.current?.abort();
 },[session]);
 const active=boundSession===session;
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!active||phase==='loading')return;
  const teacherId=id.trim();
  if(!validId.test(teacherId)){setPhase('invalid');return;}
  current.current?.abort();
  const ctrl=new AbortController();current.current=ctrl;
  setPhase('loading');
  void fetchAdminTeachers(ctrl.signal,teacherId).then(result=>{
   if(ctrl.signal.aborted)return;
   const teacher=result.teachers[0];
   if(!teacher){setPhase('missing');return;}
   onFound(teacher);setPhase('found');
  }).catch(error=>{
   if(ctrl.signal.aborted)return;
   setPhase(error instanceof AdminTeachersError&&[401,403,404].includes(error.status)
    ?'denied':'error');
  });
 }
 return <section className={css.staffLookup} aria-label="إظهار شيخ خارج أول خمسين سجلًا">
  <form className={css.staffLookupForm} onSubmit={submit}>
   <label htmlFor="admin-exact-teacher-id">شيخ غير ظاهر؟ أدخل معرّف ملفه من سجل الدعوة أو الإدارة</label>
   <div className={css.staffLookupControls}>
    <input id="admin-exact-teacher-id" type="text" autoComplete="off"
     maxLength={128} required pattern="[a-zA-Z0-9-]{1,128}"
     dir="ltr" value={active?id:''} disabled={!active||phase==='loading'}
     onChange={e=>{setId(e.target.value);setPhase('idle');}}
     placeholder="Teacher ID" aria-describedby="admin-exact-teacher-help"/>
    <button type="submit" className={css.staffRefresh}
     disabled={!active||phase==='loading'}>
     {phase==='loading'?'جارٍ التحقق…':'إظهار الشيخ'}
    </button>
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
