'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {createTeacherReadClient,TeacherReadError,type TeacherCalendarRow,
  type TeacherRosterRow} from './teacher-read-api';
import css from './TeacherReadOnly.module.css';
import {TeacherConnectedHome,TeacherConnectedRoster,TeacherConnectedSchedule} from './TeacherConnectedPages';

/** Build-time opt-in. Default preview route and production are unchanged. */
export const TEACHER_READONLY_ENABLED =
  process.env.NEXT_PUBLIC_TEACHER_READONLY_ENABLED === 'true' &&
  process.env.NEXT_PUBLIC_ACCOUNT_UI === 'true';

type Loaded={status:'loaded';learners:readonly TeacherRosterRow[];lessons:readonly TeacherCalendarRow[]};
type Reading={status:'loading'}|Loaded|{status:'error'|'denied'|'signed-out'};
const client=createTeacherReadClient();

export function TeacherReadOnlyView({pathname}:{pathname:string}) {
  const [state,setState]=useState<Reading>({status:'loading'});
  const [refreshKey,setRefreshKey]=useState(0);
  useEffect(()=>{
    let controller:AbortController|null=null;
    let alive=true;
    const refresh=async()=>{
      controller?.abort();
      const current=new AbortController();controller=current;
      setState({status:'loading'});
      try {
        const [learners,lessons]=await Promise.all([client.roster(current.signal),client.lessons(current.signal)]);
        if(alive&&!current.signal.aborted)setState({status:'loaded',learners,lessons});
      } catch(error) {
        if(!alive||current.signal.aborted)return;
        setState({status:error instanceof TeacherReadError&&error.status===401?'signed-out':
          error instanceof TeacherReadError&&error.status===403?'denied':'error'});
      }
    };
    const onVisible=()=>{if(document.visibilityState==='visible')void refresh();};
    const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel('noor-account-session');
    if(channel)channel.onmessage=()=>void refresh();
    window.addEventListener('pageshow',refresh);
    document.addEventListener('visibilitychange',onVisible);
    void refresh();
    return ()=>{alive=false;controller?.abort();channel?.close();
      window.removeEventListener('pageshow',refresh);
      document.removeEventListener('visibilitychange',onVisible);};
  },[refreshKey]);
  if(state.status==='loading')return <section className={css.card} role="status">
    <h1>جاري التحقق من صلاحيات الشيخ...</h1><p>لن تظهر بيانات تجريبية بدل سجلات الطلاب.</p></section>;
  if(state.status!=='loaded')return <section className={css.card} role="alert">
    <h1>{state.status==='denied'?'غير مصرح بعرض بوابة الشيخ':
      state.status==='signed-out'?'يلزم تسجيل الدخول':'تعذر تحميل بيانات الشيخ'}</h1>
    <p>{state.status==='denied'?'الحساب غير مسجل كشيخ مؤهل ونشط، أو أن الصلاحية أُلغيت.':
      state.status==='signed-out'?'تحتاج إلى جلسة حساب نشطة.':
      'تعذر التحقق من البيانات على الخادم. لن نعرض أسماء أو مواعيد افتراضية.'}</p>
    <div className={css.actions}><button type="button" onClick={()=>setRefreshKey(v=>v+1)}>إعادة المحاولة</button>
      <Link href="/student">العودة لتسجيل الدخول</Link></div>
  </section>;

  const {learners,lessons}=state;
  if(pathname==='/teacher')return <TeacherConnectedHome learners={learners} lessons={lessons}/>;
  if(pathname==='/teacher/students')return <TeacherConnectedRoster learners={learners}/>;
  if(pathname==='/teacher/schedule')return <TeacherConnectedSchedule learners={learners} lessons={lessons}/>;
  return <section className={css.card} role="status"><h1>هذا القسم قيد ربط الخدمة المحمية</h1>
    <p>التقارير والتقييمات والخطط والواجبات والإشعارات لا تعرض بيانات تجريبية في وضع الحساب الحقيقي، ولا يمكن حفظها أو نشرها قبل تفعيل API مؤمّن.</p>
    <div className={css.actions}><Link href="/teacher/students">طلابي</Link>
      <Link href="/teacher/schedule">جدولي</Link></div>
  </section>;
}
