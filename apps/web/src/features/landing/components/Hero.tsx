import styles from '../LandingPage.module.css';
export function Hero() {
  return <section id="top" className={styles.hero}>
    <div className={styles.container}>
      <div>
        <span className={styles.eyebrow}>نور القرآن • للحفظ والإتقان</span>
        <h1>مع القرآن يزهر القلب ويستقيم اللسان</h1>
        <p>تعلم التلاوة والحفظ والمراجعة في رحلة منظمة مع معلم متخصص، من أي مكان وفي الوقت المناسب لك.</p>
        <div className={styles.actions}>
          <a className={styles.primary} href="#enroll">احجز حصة تجريبية</a>
          <a className={styles.secondary} href="#programs">تعرّف على البرامج</a>
        </div>
      </div>
      <div className={styles.mushaf} aria-label="رسم توضيحي لمصحف مفتوح" role="img">
        <div className={styles.arch}><div className={styles.book}><span>نور</span><span>القرآن</span></div></div>
      </div>
    </div>
  </section>;
}
