'use client';
import Link from 'next/link';
import {useStudent} from '../StudentContext';
import styles from '../StudentPortal.module.css';

/** No balance, paid state or renewal date may be inferred from account stage.
 * This page remains explicitly blocked until the signed entitlement ledger API
 * and real payment/provider workflow are implemented and acceptance-tested.
 */
export function SubscriptionWorkspace(){
 const {selected}=useStudent();
 return <div className={styles.workspace}>
  <section className={styles.panel} aria-label="الاشتراكات الفعلية">
   <div className={styles.panelHead}><div>
    <p className={styles.eyebrow}>الملف المحدد · {selected.profile.name}</p>
    <h2>الاشتراك والحصص المتاحة</h2>
   </div></div>
   <div className={styles.subscriptionStatus} role="status">
    <span className={styles.statusNeutral}>الحالة المالية غير متاحة للتحقق</span>
    <p>لم تتصل هذه الصفحة بعد بسجل استحقاقات موثوق. لا يمكن الاستنتاج
     أن اشتراكك نشط أو منتهٍ، أو أن رصيدك صفر، من حالة ملف الطالب.</p>
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
  </section>
  <section className={styles.panel}>
   <div className={styles.panelHead}><div>
    <p className={styles.eyebrow}>بوابة المدفوعات</p><h2>تفعيل الباقات</h2>
   </div></div>
   <div className={styles.emptyBox}>
    لا توجد عملية دفع أو تجديد متاحة قبل ربط مزود الدفع وسجل الرصيد على الخادم
    والتحقق من ولي الأمر. لن نعرض أسعارًا أو خصومات أو إيصالات افتراضية.
   </div>
   <Link href="/student/lessons" className={styles.outlineButton}>
    عرض حصصي الموثّقة</Link>
  </section>
 </div>;
}
