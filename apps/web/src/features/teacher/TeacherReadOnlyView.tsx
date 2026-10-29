'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {createTeacherReadClient,TeacherReadError,type TeacherCalendarRow,
  type TeacherRosterRow} from './teacher-read-api';
import {TeacherConnectedStudents} from './TeacherConnectedStudents';
import {TeacherConnectedAssignments} from './TeacherConnectedAssignments';
import {teacherRoute} from './teacher-route';
import css from './TeacherReadOnly.module.css';

/** Build-time opt-in. Default preview route and production are unchanged. */
export const TEACHER_READONLY_ENABLED =
  process.env.NEXT_PUBLIC_TEACHER_READONLY_ENABLED === 'true' &&
  process.env.NEXT_PUBLIC_ACCOUNT_UI === 'true';

type Loaded={status:'loaded';learners:readonly TeacherRosterRow[];lessons:readonly TeacherCalendarRow[]};
type Reading={status:'loading'}|Loaded|{status:'error'|'denied'|'signed-out'};
const client=createTeacherReadClient();
const formatTime=(timestamp:number)=>new Intl.DateTimeFormat('ar-EG',{
  timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short',
}).format(new Date(timestamp));
const kindLabel={trial:'تجريبية',standard:'أساسية',makeup:'تعويضية'};
const statusLabel={scheduled:'قادمة',live:'جارية',completed:'منتهية',cancelled:'ملغاة'};

export function TeacherReadOnlyView({pathname}:{pathname:string}) {
  const route=teacherRoute(pathname);
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
  const names=new Map(learners.map(item=>[item.id,item.name]));
  const lessonCards=lessons.map(item=><div className={css.row} key={item.id}>
    <div><strong>{names.get(item.learnerId)??item.learnerName??'طالب مصرح ضمن الحصة فقط'}</strong>
      <small>{kindLabel[item.kind]} · {statusLabel[item.status]}</small></div>
    <time>{formatTime(item.startsAtMs)} – {formatTime(item.endsAtMs)}</time>
  </div>);
  if(route==='/teacher/assignments')return <TeacherConnectedAssignments learners={learners}/>;
  if(route==='/teacher/students')return <TeacherConnectedStudents learners={learners} lessons={lessons}/>;
  if(route==='/teacher/schedule')return <section className={css.card}>
    <div className={css.heading}><h1>جدولي الفعلي</h1><span>آخر {lessons.length} حصة</span></div>
    <p>المواعيد المقروءة من D1. لا توجد أزرار بدء أو إنهاء قبل ربط الحضور والتحقق الخادمي.</p>
    {lessons.length?<div className={css.list}>{lessonCards}</div>:<p className={css.empty}>لا توجد حصص مصرح بها حاليًا.</p>}
  </section>;
  if(route==='/teacher') {
    const upcoming=lessons.filter(l=>(l.status==='scheduled'||l.status==='live')&&l.endsAtMs>Date.now())
      .sort((a,b)=>a.startsAtMs-b.startsAtMs).slice(0,3);
    return <section className={css.card}>
      <h1>بوابة الشيخ — بيانات حقيقية للقراءة فقط</h1>
      <p>مرحبًا بك. هذه البيانات من API محمي بجلسة الحساب؛ لا توجد أرقام تقارير أو تسميعات مُختلَقة.</p>
      <div className={css.metrics}>
        <Link href="/teacher/students"><strong>{learners.length}</strong><span>طلابي المسندون حاليًا</span></Link>
        <Link href="/teacher/schedule"><strong>{lessons.length}</strong><span>الحصص الظاهرة في الجدول</span></Link>
      </div>
      <h2>الحصص القادمة</h2>
      {upcoming.length?<div className={css.list}>{upcoming.map(item=><div key={item.id} className={css.row}>
        <strong>{names.get(item.learnerId)??item.learnerName??'طالب مصرح ضمن الحصة فقط'}</strong>
        <time>{formatTime(item.startsAtMs)}</time>
      </div>)}</div>:<p className={css.empty}>لا توجد حصص قادمة ضمن البيانات المحمّلة.</p>}
    </section>;
  }
  return <section className={css.card}><h1>هذا القسم قيد ربط الـBackend</h1>
    <p>التقارير والتقييمات والخطط والواجبات والإشعارات لا تعرض بيانات تجريبية في وضع الحساب الحقيقي، ولا يمكن حفظها أو نشرها قبل تفعيل API مؤمّن.</p>
    <div className={css.actions}><Link href="/teacher/students">طلابي</Link><Link href="/teacher/schedule">جدولي</Link></div>
  </section>;
}
