'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useStudent} from '../StudentContext';
import {getSignedSubscriptionLedger,type SubscriptionLedgerView} from '../subscription-ledger-client';
import styles from '../StudentPortal.module.css';

type ViewState={status:'loading'|'ready'|'error';data:SubscriptionLedgerView|null};
const formatDate=(date:number)=>new Date(date).toLocaleDateString('ar-EG',{
 year:'numeric',month:'long',day:'numeric',
});

/** Strict real D1 read. Demo profiles cannot call an entitlement endpoint and
 * an HTTP/network failure never turns into zero credits or a paid subscription.
 * StudentSection remounts this component for every switched learner.
 */
export function SubscriptionWorkspace(){
 const {selected}=useStudent();
 const profile=selected.profile;
 const [state,setState]=useState<ViewState>({status:'loading',data:null});
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  if(profile.demo){
   setState({status:'error',data:null});
   return;
  }
  const controller=new AbortController();
  setState({status:'loading',data:null});
  void getSignedSubscriptionLedger(profile.id,controller.signal).then(data=>{
   if(!controller.signal.aborted)setState({status:'ready',data});
  }).catch(()=>{
   if(!controller.signal.aborted)setState({status:'error',data:null});
  });
  return()=>controller.abort();
 },[profile.id,profile.demo,refresh]);
 const cycle=state.status==='ready'?state.data?.latestCycle:null;
 const compensation=state.status==='ready'?state.data?.compensationUnspentSessions:null;
 const metrics:readonly [string,string,string][]=[
  ['الحصص المسجلة في آخر دورة',
   cycle?String(cycle.baseSessions+cycle.rolloverSessions):'—',
   'وحدات تعليمية مسجلة؛ ليست إثباتًا للدفع'],
  ['المستخدم من آخر دورة',
   cycle?String(cycle.spentSessions):'—',
   'الحصص المقيدة في سجل النظام'],
  ['المتبقي في آخر دورة',
   cycle?String(cycle.recordedUnspentSessions):'—',
   'رصيد تاريخي، لا يعني إمكانية حجز حصة'],
  ['تعويضات غير مستهلكة',
   compensation!==null?String(compensation):'—',
   'لا تنتهي صلاحيتها بعد اعتمادها'],
 ];
 return <div className={styles.workspace}>
  <section className={styles.panel} aria-label="الاشتراك الحقيقي لهذا الطالب">
   <div className={styles.panelHead}><div>
    <p className={styles.eyebrow}>الملف المحدد · {profile.name}</p>
    <h2>الاشتراك وسجل الحصص</h2>
   </div>
    {!profile.demo&&<button type="button" className={styles.outlineButton}
      onClick={()=>setRefresh(n=>n+1)}>تحديث من الخادم</button>}
   </div>
   <div className={styles.subscriptionStatus} role="status">
    <span className={styles.statusNeutral}>الحجز المدفوع غير مفعّل</span>
    {profile.demo?
     <p>هذا ملف تجريبي. لا توجد له بيانات اشتراك أو أرصدة مالية موثّقة؛ سجل الدخول بحساب حقيقي لعرض بياناته.</p>:
     state.status==='loading'?
      <p>جارٍ التحقق من سجل الحصص الخاص بهذا الطالب…</p>:
     state.status==='error'?
      <p role="alert">تعذّر التحقق من سجل الاشتراك. لم نعرض رصيدًا صفريًا أو اشتراكًا افتراضيًا. جرّب «تحديث من الخادم».</p>:
     !cycle?
      <p>لا توجد دورة اشتراك مسجلة لهذا الطالب في قاعدة البيانات. هذا لا يُعدّ إثباتًا لحالة دفع أو تجديد.</p>:
      <p>آخر دورة مسجلة من {formatDate(cycle.startsAtMs)} إلى {formatDate(cycle.endsAtMs)}.
       {cycle.state==='expired'?' انتهت فترة هذه الدورة.':' هذه الفترة لا تعني أن الحجوزات المدفوعة مفعلة.'}</p>}
   </div>
   {state.status==='ready'&&!profile.demo&&
    <div className={styles.metricGrid} aria-label="وحدات الاشتراك الموثقة">
     {metrics.map(([title,value,description])=><div className={styles.metric} key={title}>
      <span>{title}</span><strong>{value}</strong><small>{description}</small>
     </div>)}
    </div>}
   {state.status==='ready'&&!profile.demo&&state.data&&
    <p>عدد قرارات التعويض المسجلة: {state.data.compensationGrantCount}.</p>}
  </section>
  <section className={styles.panel}>
   <div className={styles.panelHead}><div>
    <p className={styles.eyebrow}>التجديد والحجز</p><h2>إدارة الاشتراك</h2>
   </div></div>
   <div className={styles.emptyBox}>
    التفعيل والتجديد والحجز المدفوع ما زالوا غير متاحين. الأرقام التعليمية أعلاه
    لا تمثل إيصال دفع أو صلاحية للحجز. سيتم توفير الباقات بعد اعتماد الإدارة وسجل
    الحجز والخصم ومزود الدفع.
   </div>
   <Link href="/student/lessons" className={styles.outlineButton}>
    عرض حصصي الموثقة
   </Link>
  </section>
 </div>;
}
