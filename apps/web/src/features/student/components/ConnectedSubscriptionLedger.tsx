'use client';
import {useEffect,useState} from 'react';
import {subscriptionLedgerClient,type SubscriptionLedger} from '../../shared';
import styles from '../StudentPortal.module.css';

type View={phase:'loading'}|{phase:'error'}|
 {phase:'ready';ledger:SubscriptionLedger};
const format=new Intl.DateTimeFormat('ar-EG',{
 timeZone:'Africa/Cairo',dateStyle:'medium'
});
/** Read-only signed owner data. Never treats academic units as paid/bookable. */
export function ConnectedSubscriptionLedger({learnerId}:{learnerId:string}){
 const [view,setView]=useState<View>({phase:'loading'});
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setView({phase:'loading'});
  void subscriptionLedgerClient.owner(learnerId,controller.signal).then(ledger=>{
   if(!controller.signal.aborted)setView({phase:'ready',ledger});
  }).catch(()=>{
   if(!controller.signal.aborted)setView({phase:'error'});
  });
  return()=>controller.abort();
 },[learnerId,retry]);
 const cycle=view.phase==='ready'?view.ledger.latestCycle:null;
 return <section className={styles.panel} aria-label="سجل الوحدات الأكاديمية الموثّق">
  <div className={styles.panelHead}><div>
   <p className={styles.eyebrow}>سجل أكاديمي من الخادم</p>
   <h2>الحصص والتعويضات المسجلة</h2>
  </div><button type="button" className={styles.outlineButton}
   onClick={()=>setRetry(v=>v+1)}>تحديث السجل</button></div>
  {view.phase==='loading'?<p role="status">جارٍ التحقق من سجل هذا الطالب…</p>:
   view.phase==='error'?<div role="alert">
    تعذّر التحقق من السجل؛ لن نعرض رصيدًا افتراضيًا أو نفترض عدم وجود اشتراك.
   </div>:<>
    <p role="status">هذه وحدات حصص أكاديمية مسجلة فقط، وليست تأكيد دفع أو
     تصريح حجز. تفعيل الاشتراكات المدفوعة والتجديد غير متاح بعد.</p>
    <div className={styles.metricGrid}>
     <div className={styles.metric}><span>وحدات الدورة المسجلة غير المستهلكة</span>
      <strong>{cycle?cycle.recordedUnspentSessions:'—'}</strong>
      <small>ليست رصيدًا متاحًا للحجز</small></div>
     <div className={styles.metric}><span>وحدات التعويض غير المستهلكة</span>
      <strong>{view.ledger.compensationUnspentSessions}</strong>
      <small>سجل أكاديمي، دون حجز تلقائي</small></div>
     <div className={styles.metric}><span>قرارات التعويض المسجلة</span>
      <strong>{view.ledger.compensationGrantCount}</strong>
      <small>لا تمثل مدفوعات</small></div>
    </div>
    {cycle?<p>الفترة المسجلة: {format.format(new Date(cycle.startsAtMs))}
     {' — '}{format.format(new Date(cycle.endsAtMs))}.
     لا يُستنتج من هذه التواريخ تجديد تلقائي أو صلاحية حجز.</p>:
     <p className={styles.emptyBox}>لا توجد دورة اشتراك مسجلة لهذا الطالب بعد.
      لا يعني ذلك فشل دفع أو وجود رصيد صفري معتمد.</p>}
   </>}
 </section>;
}
