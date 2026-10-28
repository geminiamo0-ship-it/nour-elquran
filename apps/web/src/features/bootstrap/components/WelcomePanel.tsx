import { SurfaceCard } from '@/shared/ui/SurfaceCard';
import styles from './WelcomePanel.module.css';

export function WelcomePanel() {
  return (
    <main className={styles.main} aria-labelledby="page-title">
      <header className={styles.brand} aria-label="هوية نور القرآن">
        <svg className={styles.mark} viewBox="0 0 48 48" aria-hidden="true">
          <path d="M27 4a18 18 0 1 0 15 31A18 18 0 0 1 27 4Z" fill="currentColor" />
          <path d="M9 30q7-4 15 0v12q-8-4-15 0z M24 30q8-4 15 0v12q-8-4-15 0z" fill="var(--paper-2)" stroke="var(--olive)" strokeWidth="1.5" />
        </svg>
        <div>
          <p className={styles.brandTitle}>نور القرآن</p>
          <p className={styles.brandCaption}>للحفظ والإتقان</p>
        </div>
      </header>
      <SurfaceCard>
        <p className={styles.eyebrow}>الأساس التقني — نسخة تجريبية</p>
        <h1 id="page-title" className={styles.title}>نبدأ رحلة القرآن على أساس متين</h1>
        <p className={styles.lead}>
          هذه واجهة تأسيسية للتحقق من التصميم العربي وتقسيم المكونات والاختبارات فقط.
          لا توجد حسابات أو حجوزات أو حصص حقيقية مفعّلة حتى الآن.
        </p>
        <p className={styles.note}>
          الصفحة التسويقية والتسجيل ولوحات الطالب والشيخ والإدارة ستُنفّذ في مهام مستقلة.
        </p>
      </SurfaceCard>
    </main>
  );
}
