import styles from '../LandingPage.module.css';
export function Classroom() {
  return <section id="classroom" className={styles.classroom}>
    <div className={styles.container}>
      <div>
        <span className={styles.eyebrow}>الحصة التفاعلية</span>
        <h2>المصحف أمامكم والحفظ هدفكم</h2>
        <p>يشاهد المعلم والطالب المصحف نفسه، ويمكنهما وضع علامات بالقلم والتظليل وكتابة الملاحظات أثناء الحصة.</p>
        <p>بعد الحصة، يمكن الرجوع إلى الصفحات المشروحة وتقرير المتابعة. المعروض هنا تصور للواجهة، وليس اتصالًا مباشرًا حاليًا.</p>
      </div>
      <div className={styles.classroomPreview} aria-label="تصور للمصحف المشترك">
        <div className={styles.previewTop}><span>المصحف التفاعلي</span><span>عرض توضيحي</span></div>
        <div className={styles.previewPages}><div>صفحة المصحف</div><div>ملاحظات المعلم والطالب</div></div>
        <div className={styles.previewBottom}>قلم · تظليل · ملاحظات · حفظ الصفحة</div>
      </div>
    </div>
  </section>;
}
