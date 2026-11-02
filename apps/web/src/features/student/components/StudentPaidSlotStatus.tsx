'use client';
import {useEffect,useState} from 'react';
import {fetchPaidSlotRequests,type PaidSlotRequest} from '../paid-slot-requests-client';
import styles from '../StudentPortal.module.css';
import {currentLearnerRead,type LearnerScoped} from './learner-scope';

const date=new Intl.DateTimeFormat('ar-EG',{
 timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'
});
export function StudentPaidSlotStatus({learnerId}:{learnerId:string}){
 const [view,setView]=useState<LearnerScoped<PaidSlotRequest>>({
  learnerId,status:'loading',rows:[]
 });
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setView({learnerId,status:'loading',rows:[]});
  void fetchPaidSlotRequests(learnerId,controller.signal).then(requests=>{
   if(!controller.signal.aborted)setView({learnerId,status:'ready',rows:requests});
  }).catch(()=>{
   if(!controller.signal.aborted)setView({learnerId,status:'error',rows:[]});
  });
  return()=>controller.abort();
 },[learnerId,revision]);
 // Never expose another sibling's pending requests between prop change and effect.
 const visible=currentLearnerRead(view,learnerId);
 return <section className={styles.panel} dir="rtl" aria-label="طلبات الحصص المدفوعة">
  <div className={styles.panelHead}><div>
   <p className={styles.eyebrow}>طلباتك الفعلية من الخادم</p>
   <h2>طلبات مواعيد الحصص المدفوعة</h2>
  </div><button type="button" className={styles.outlineButton}
   onClick={()=>setRevision(v=>v+1)}>تحديث الطلبات</button></div>
  <p>طلب الموعد لا يحجز حصة ولا يخصم رصيدًا؛ الاعتماد يتم من الإدارة فقط.</p>
  {visible.status==='loading'?<p role="status">جارٍ التحقق من الطلبات…</p>:
   visible.status==='error'?<p role="alert">
    تعذر قراءة الطلبات من الخادم حاليًا. لا نعرض طلبات أو موافقات افتراضية.
   </p>:visible.rows.length===0?<p className={styles.emptyBox}>
    لا توجد طلبات مواعيد مدفوعة مسجلة لهذا الطالب.
   </p>:<div className={styles.stack}>{visible.rows.map(item=>
    <article key={item.requestId} className={styles.lessonRow}>
     <div className={styles.lessonInfo}>
      <strong>{date.format(new Date(item.startsAtMs))}</strong>
      <span>{item.state==='pending'?'بانتظار قرار الإدارة':
       item.state==='expired'?'انتهى الموعد دون اعتماد الحجز':
       item.state==='approved'?'تم اعتماد الحجز':'رفضت الإدارة الطلب'}</span>
     </div>
    </article>)}</div>}
  <small>تقديم طلب جديد يتطلب عرضًا متصلًا للرصيد والشيخ والمواعيد المتاحة،
   ولن نعرض اختيارًا غير موثق على أنه حجز حقيقي.</small>
 </section>;
}
