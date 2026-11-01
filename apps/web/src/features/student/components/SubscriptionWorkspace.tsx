'use client';
import Link from 'next/link';
import {useStudent} from '../StudentContext';
import styles from '../StudentPortal.module.css';
import {ConnectedSubscriptionLedger} from './ConnectedSubscriptionLedger';
import {ConnectedAcademyOffers} from './ConnectedAcademyOffers';

/** Signed academic ledger facts are not payment or booking authorization. */
export function SubscriptionWorkspace(){
 const {selected}=useStudent();
 return <div className={styles.workspace}>
  {selected.profile.demo?<section className={styles.panel}
   aria-label="الاشتراكات الفعلية">
   <div className={styles.panelHead}><div>
    <p className={styles.eyebrow}>الملف المحدد · {selected.profile.name}</p>
    <h2>الاشتراك والحصص المتاحة</h2>
   </div></div>
   <div className={styles.subscriptionStatus} role="status">
    <span className={styles.statusNeutral}>الحالة المالية غير متاحة للتحقق</span>
    <p>لا يمكن الاستنتاج أن اشتراكك نشط أو منتهٍ، أو أن رصيدك صفر،
     من حالة ملف الطالب التجريبية.</p>
   </div>
   <div className={styles.metricGrid}>
    {[
     ['الرصيد المتاح','يتطلب سجل الحصص المعتمد'],
     ['تاريخ التجديد','يتطلب اشتراكًا موثّقًا'],
     ['التعويضات','تُثبت بقرار إداري وسجل تعويض'],
     ['الفواتير','تتطلب سجل مدفوعات معتمد'],
    ].map(([title,description])=><div className={styles.metric} key={title}>
     <span>{title}</span><strong>—</strong><small>{description}</small>
    </div>)}
   </div>
  </section>:<ConnectedSubscriptionLedger learnerId={selected.profile.id}/>}
  {!selected.profile.demo&&<ConnectedAcademyOffers learnerId={selected.profile.id}/>}
  <section className={styles.panel}>
   <p>الحصة التجريبية مجانية مرة واحدة لكل طالب. بعد اختيار الموعد المتاح، يمكنك
    مراجعة تفاصيل الحجز من صفحة الحصص.</p>
   <Link href="/student/lessons" className={styles.outlineButton}>
    مواعيد الحصص والتجربة المجانية</Link>
  </section>
 </div>;
}
