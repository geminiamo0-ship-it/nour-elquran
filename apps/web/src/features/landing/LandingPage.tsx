import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Programs } from './components/Programs';
import { Classroom } from './components/Classroom';
import { Enrollment } from './components/Enrollment';
import { Footer } from './components/Footer';
import styles from './LandingPage.module.css';

export function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <section className={styles.benefits} aria-label="مميزات الدراسة">
          <div className={styles.container}>
            <div><strong>خطة واضحة</strong><p>رحلة تعليمية متدرجة تناسب مستواك.</p></div>
            <div><strong>تصحيح مباشر</strong><p>تسميع ومتابعة مع معلم متخصص.</p></div>
            <div><strong>مواعيد مناسبة</strong><p>اختيار الوقت المناسب من المواعيد المتاحة.</p></div>
          </div>
        </section>
        <Programs />
        <Classroom />
        <section className={styles.verse} aria-label="رسالتنا">
          <div className={styles.container}>
            <p className={styles.ayah}>﴿ وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ ﴾</p>
            <h2>رحلة قرآنية لكل عمر</h2>
            <p>للأطفال بإشراف أولياء أمورهم، وللكبار من الرجال والنساء، مع مراعاة المستوى والهدف.</p>
          </div>
        </section>
        <section className={styles.steps} id="how-it-works">
          <div className={styles.container}>
            <h2>ثلاث خطوات لبداية رحلتك</h2>
            <ol>
              <li><span>١</span><strong>أنشئ حسابك</strong><p>سجّل بيانات التواصل وأضف المتعلم.</p></li>
              <li><span>٢</span><strong>ادخل لوحة الطالب</strong><p>تابع ملف كل متعلم بشكل مستقل.</p></li>
              <li><span>٣</span><strong>احجز الحصة التجريبية</strong><p>اختر موعدًا من داخل لوحة الطالب.</p></li>
            </ol>
          </div>
        </section>
        <Enrollment />
        <section className={styles.faq} id="faq">
          <div className={styles.container}>
            <h2>الأسئلة الشائعة</h2>
            <details><summary>هل البرامج مناسبة للأطفال؟</summary><p>نعم، يوجد مسار مناسب للأطفال مع متابعة ولي الأمر من نفس الحساب.</p></details>
            <details><summary>هل يمكن إضافة أكثر من متعلم؟</summary><p>نعم، لكل متعلم ملف مستقل داخل حساب واحد.</p></details>
            <details><summary>متى أحجز الحصة التجريبية؟</summary><p>بعد التسجيل، من داخل لوحة الطالب.</p></details>
            <details><summary>هل التسجيل هنا حقيقي الآن؟</summary><p>هذه نسخة تجريبية للواجهة، ولا تنشئ حسابًا حقيقيًا أو ترسل بيانات إلى خادم.</p></details>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
