'use client';
import { useStudent } from '../StudentContext';
import styles from '../StudentPortal.module.css';

const stageCopy = {
  new: ['بدون اشتراك', 'ابدأ بحجز الحصة التجريبية عند تفعيل نظام المواعيد.'],
  trial_booked: ['حصة تجريبية · مثال', 'الموعد المعروض نموذج فقط؛ لا يوجد اشتراك حقيقي.'],
  assessed: ['انتظار اختيار الباقة', 'بعد نشر تقييم الشيخ يمكن مراجعة الباقات المعتمدة.'],
  active: ['نشط في بيانات التجربة', 'هذا مثال لحالة اشتراك، وليس تصريحًا ماليًا أو رصيدًا فعليًا.'],
  lapsed: ['اشتراك منتهي · مثال', 'يمكن مراجعة خيارات التجديد حين يُفعّل نظام الدفع.'],
} as const;
export function SubscriptionWorkspace() {
  const { selected } = useStudent();
  const [status, description] = stageCopy[selected.profile.stage];
  return <div className={styles.workspace}>
    <section className={styles.panel}>
      <div className={styles.panelHead}><div><p className={styles.eyebrow}>ملف الطالب المحدد</p><h2>ملخص الاشتراك</h2></div></div>
      <div className={styles.subscriptionStatus}>
        <span className={styles.statusNeutral}>{status}</span>
        <p>{description}</p>
      </div>
      <div className={styles.metricGrid}>
        <div className={styles.metric}><span>الرصيد المتاح</span><strong>—</strong><small>ليس متصلًا بسجل استحقاقات</small></div>
        <div className={styles.metric}><span>موعد التجديد</span><strong>—</strong><small>لا توجد دورة دفع معتمدة</small></div>
        <div className={styles.metric}><span>الحصص التعويضية</span><strong>—</strong><small>غير محسوبة في الواجهة</small></div>
        <div className={styles.metric}><span>الفواتير</span><strong>—</strong><small>لا توجد مدفوعات في المعاينة</small></div>
      </div>
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHead}><div><p className={styles.eyebrow}>الشفافية المالية</p><h2>إدارة الباقة والمدفوعات</h2></div></div>
      <div className={styles.emptyBox}>لم يُعتمد مزود الدفع أو الأسعار هنا. عند تفعيل الخدمة سيتم ربط صفحة الدفع بالموافقة الرسمية لولي الأمر، وبسجل رصيد موثّق، وإيصالات وحالة خصم واضحة.</div>
      <p className={styles.panelFoot}>لا توجد أزرار شراء وهمية، أو رصيد مُفترض، أو معاملة مالية تُنشأ في هذه الصفحة.</p>
    </section>
  </div>;
}
