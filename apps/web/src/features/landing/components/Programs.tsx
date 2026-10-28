import { Card } from '@/shared/ui';
import styles from '../LandingPage.module.css';
const programs = [
  { title: 'تصحيح التلاوة', description: 'تعلم النطق الصحيح ومخارج الحروف مع ملاحظات المعلم.' },
  { title: 'حفظ القرآن الكريم', description: 'ورد حفظ مناسب للمستوى مع تسميع ومتابعة منتظمة.' },
  { title: 'المراجعة والتثبيت', description: 'خطة مراجعة تساعد على تثبيت ما سبق حفظه.' },
];
export function Programs() {
  return <section id="programs" className={styles.section}>
    <div className={styles.container}>
      <span className={styles.eyebrow}>برامجنا</span>
      <h2>لكل مرحلة طريق إلى الإتقان</h2>
      <div className={styles.cards}>{programs.map((program, index) =>
        <Card as="article" key={program.title}>
          <span className={styles.cardNumber}>٠{index + 1}</span>
          <h3>{program.title}</h3><p>{program.description}</p>
        </Card>)}</div>
    </div>
  </section>;
}
