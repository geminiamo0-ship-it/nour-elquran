'use client';
import {useEffect,useState} from 'react';
import type {AccountSession} from '@/features/account';
import {AdminTeachersError,fetchAdminTeachers,reconcileVerifiedTeacherRows,
 type AdminTeacher,type AdminTeacherDirectoryValue}
 from './admin-teachers-client';
import css from './AdminPortal.module.css';
import {AdminOperations} from './AdminOperations';
import {AdminTeacherIdLookup} from './AdminTeacherIdLookup';
import {AdminAcademyMvp} from './AdminAcademyMvp';
import type {AdminActionResult} from './admin-operations-client';

type State=
 |{phase:'loading'}
 |{phase:'ready';session:AccountSession;value:AdminTeacherDirectoryValue}
 |{phase:'denied'|'error'};
type StaffReceipt={session:AccountSession;value:AdminActionResult};
/** A missing exact-ID result is material only when the Sheikh was already
 * selectable. Revalidate the whole signed roster before allowing actions. */
export function adminTeacherMissingLookupRequiresRefresh(
 teacherId:string,visible:readonly AdminTeacher[],
):boolean{
 return visible.some(teacher=>teacher.id===teacherId);
}
/** Keep a confirmed D1 receipt through a retry, never after a fresh staff denial. */
export function AdminTeacherReceipt({session,receipt,denied}:{
 session:AccountSession;receipt:StaffReceipt|null;denied:boolean;
}){
 if(denied||receipt?.session!==session)return null;
 return <p role="status" className={css.staffInfo}>
  تم تأكيد الإجراء وحفظه: {receipt.value.code}. جارٍ تحديث السجل من الخادم.
 </p>;
}
const cairo=new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',
 dateStyle:'medium',timeStyle:'short'});
/** Mounted only after AdminShell has verified a fresh signed staff overview.
 * Component unmounts on account change, route change and privilege recheck.
 */
export function AdminTeacherDirectory({session}:{session:AccountSession}){
 const [state,setState]=useState<State>({phase:'loading'});
 const [retry,setRetry]=useState(0);
 const [lookup,setLookup]=useState<{session:AccountSession;teachers:readonly AdminTeacher[]}|null>(null);
 const [latestAck,setLatestAck]=useState<StaffReceipt|null>(null);
 useEffect(()=>{
  const controller=new AbortController();
  setState({phase:'loading'});setLookup(null);
  void fetchAdminTeachers(controller.signal).then(value=>{
   if(!controller.signal.aborted)setState({phase:'ready',session,value});
  }).catch(error=>{
   if(controller.signal.aborted)return;
   const denied=error instanceof AdminTeachersError&&[401,403,404].includes(error.status);
   if(denied){
    // A later signed denial overrides even a previously confirmed staff receipt.
    setLookup(null);setLatestAck(null);
   }
   setState({phase:denied?'denied':'error'});
  });
  return ()=>controller.abort();
 },[session,retry]);
 const ready=state.phase==='ready'&&state.session===session?state.value:null;
 const lookedUp=lookup?.session===session?lookup.teachers:[];
 // An exact-ID recheck may return a changed qualification/status. The
 // newer signed receipt wins even when that ID was already in the first 50.
 const teachers=ready?reconcileVerifiedTeacherRows(ready.teachers,lookedUp):[];
 const revokeStaffAccess=()=>{
  setState(current=>current.phase==='ready'&&current.session===session
   ?{phase:'denied'}:current);
  setLookup(current=>current?.session===session?null:current);
  setLatestAck(current=>current?.session===session?null:current);
 };
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
   {ready.truncated&&<AdminTeacherIdLookup session={session}
    onFound={teacher=>setLookup(current=>{
     const previous=current?.session===session?current.teachers:[];
     return {session,teachers:reconcileVerifiedTeacherRows(previous,[teacher])};
    })}
    onMissing={teacherId=>{
     if(!adminTeacherMissingLookupRequiresRefresh(teacherId,teachers))return;
     // The old signed row must not remain actionable after a newer 200/empty
     // exact-ID receipt. Unmount actions until a fresh staff roster is read.
     setState({phase:'loading'});setLookup(null);setLatestAck(null);
     setRetry(n=>n+1);
    }}
    onAccessRevoked={revokeStaffAccess}/>}
   {teachers.length===0?<div className={css.staffEmpty}>
    لا يوجد شيوخ مسجلون في قاعدة البيانات حاليًا.
   </div>:<div className={css.staffRows} aria-label="دليل الشيوخ الموثق">
    {teachers.map(teacher=><article className={css.staffCard} key={teacher.id}>
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
  <AdminTeacherReceipt session={session} receipt={latestAck}
   denied={state.phase==='denied'}/>
  {ready&&<AdminAcademyMvp key={session.user.id}
   session={session} mode="invites"/>}
  {ready&&<AdminOperations kind="teacher" session={session} teachers={teachers}
   onAccessRevoked={revokeStaffAccess} onApplied={value=>{setLatestAck({session,value});setLookup(null);setRetry(n=>n+1);}}/>}
 </div>;
}
