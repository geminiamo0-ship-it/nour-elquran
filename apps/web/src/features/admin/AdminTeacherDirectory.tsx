'use client';
import {useEffect,useState} from 'react';
import type {AccountSession} from '@/features/account';
import {AdminTeachersError,fetchAdminTeachers,type AdminTeacherDirectoryValue}
 from './admin-teachers-client';
import css from './AdminPortal.module.css';
import {AdminOperations} from './AdminOperations';
import {AdminAcademyMvp} from './AdminAcademyMvp';
import type {AdminActionResult} from './admin-operations-client';

type State=
 |{phase:'loading'}
 |{phase:'ready';value:AdminTeacherDirectoryValue}
 |{phase:'denied'|'error'};
const cairo=new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',
 dateStyle:'medium',timeStyle:'short'});
/** Mounted only after AdminShell has verified a fresh signed staff overview.
 * Component unmounts on account change, route change and privilege recheck.
 */
export function AdminTeacherDirectory({session}:{session:AccountSession}){
 const [state,setState]=useState<State>({phase:'loading'});
 const [retry,setRetry]=useState(0);
 const [latestAck,setLatestAck]=useState<{session:AccountSession;value:AdminActionResult}|null>(null);
 useEffect(()=>{
  const controller=new AbortController();
  setState({phase:'loading'});
  void fetchAdminTeachers(controller.signal).then(value=>{
   if(!controller.signal.aborted)setState({phase:'ready',value});
  }).catch(error=>{
   if(controller.signal.aborted)return;
   setState({phase:error instanceof AdminTeachersError&&
    [401,403,404].includes(error.status)?'denied':'error'});
  });
  return ()=>controller.abort();
 },[session,retry]);
 const ready=state.phase==='ready'?state.value:null;
 return <div className={css.staffDirectory}>
  <section className={css.staffIntro} aria-labelledby="admin-teachers-heading">
   <p className={css.kicker}>إدارة الشيوخ · قراءة فقط</p>
   <h1 id="admin-teachers-heading">دليل شيوخ الأكاديمية</h1>
   <p>بيانات أكاديمية محدودة من Cloudflare D1 بعد التحقق من تصريح الإدارة.
    السجل للعرض والتحقق. العمليات المعتمدة تظهر أسفله، وتتطلب هوية حساب موثقة وسببًا وتأكيدًا من قاعدة البيانات.</p>
  </section>
  <div className={css.staffTopline}>
   <h2>سجل الشيوخ</h2>
   <button className={css.staffRefresh} type="button"
    disabled={state.phase==='loading'} onClick={()=>setRetry(n=>n+1)}>
    تحديث السجل
   </button>
  </div>
  {state.phase==='loading'&&<div className={css.staffEmpty} role="status">
   جارٍ قراءة سجل الشيوخ المصرح به…
  </div>}
  {state.phase==='denied'&&<div className={css.staffError} role="alert">
   تعذّر التحقق من صلاحية عرض دليل الشيوخ. لا تظهر أي بيانات محفوظة.
   <button type="button" onClick={()=>setRetry(n=>n+1)}>إعادة التحقق</button>
  </div>}
  {state.phase==='error'&&<div className={css.staffError} role="alert">
   السجل غير متاح الآن. لن نعرض بيانات تجريبية أو أرقامًا غير موثقة.
   <button type="button" onClick={()=>setRetry(n=>n+1)}>إعادة المحاولة</button>
  </div>}
  {ready&&<>
   <div className={css.staffInfo} role="status">
    آخر قراءة موثقة: {cairo.format(new Date(ready.asOfMs))} ·
    {ready.truncated?' عرض أول ٥٠ شيخًا فقط، توجد سجلات إضافية.':
     ` ${ready.teachers.length.toLocaleString('ar-EG')} سجل في الدليل.`}
   </div>
   {ready.teachers.length===0?<div className={css.staffEmpty}>
    لا يوجد شيوخ مسجلون في قاعدة البيانات حاليًا.
   </div>:<div className={css.staffRows} aria-label="دليل الشيوخ الموثق">
    {ready.teachers.map(teacher=><article className={css.staffCard} key={teacher.id}>
     <div className={css.staffIdentity}>
      <strong>{teacher.name}</strong>
      <small>معرّف الشيخ للجدولة: <code dir="ltr">{teacher.id}</code></small>
      <span className={teacher.status==='active'?css.staffState:
       `${css.staffState} ${css.staffStateOff}`}>
       {teacher.status==='active'?'نشط':'موقوف'}
      </span>
      <small>{teacher.qualified?'مؤهل معتمد':'التأهيل غير معتمد'}</small>
     </div>
     <div className={css.staffCount}><small>طلاب مرتبطون حاليًا</small>
      <strong>{teacher.currentLearners.toLocaleString('ar-EG')}</strong></div>
     <div className={css.staffCount}><small>حصص مجدولة قادمة</small>
      <strong>{teacher.upcomingLessons.toLocaleString('ar-EG')}</strong></div>
    </article>)}
   </div>}
  </>}
  {latestAck?.session===session&&<p role="status" className={css.staffInfo}>
   تم تأكيد الإجراء وحفظه: {latestAck.value.code}. جارٍ تحديث السجل من الخادم.
  </p>}
  <AdminAcademyMvp key={session.user.id} session={session} mode="invites"/>
  {ready&&<AdminOperations kind="teacher" session={session} teachers={ready.teachers}
   onApplied={value=>{setLatestAck({session,value});setRetry(n=>n+1);}}/>}
 </div>;
}
