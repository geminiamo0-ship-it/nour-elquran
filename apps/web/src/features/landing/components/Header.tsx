import styles from '../LandingPage.module.css';
export function Header() {
  return <header className={styles.header}>
    <div className={styles.container}>
      <a href="#top" className={styles.brand} aria-label="نور القرآن - الصفحة الرئيسية">
        <span className={styles.mark} aria-hidden="true">☾<span className={styles.miniBook}>▱</span></span>
        <span><strong>نور القرآن</strong><small>للحفظ والإتقان</small></span>
      </a>
      <nav aria-label="التنقل الرئيسي">
        <a href="#programs">البرامج</a>
        <a href="#classroom">المصحف التفاعلي</a>
        <a href="#how-it-works">كيف نبدأ؟</a>
        <a href="#faq">الأسئلة</a>
      </nav>
      <a className={styles.headerCta} href="#enroll">احجز حصة تجريبية</a>
    </div>
  </header>;
}
