import { SurfaceCard } from '@/shared/ui/SurfaceCard';

export function WelcomePanel() {
  return (
    <main className="bootstrap-main" aria-labelledby="page-title">
      <header className="bootstrap-brand" aria-label="هوية نور القرآن">
        <span className="brand-mark" aria-hidden="true">☪</span>
        <div>
          <p className="brand-title">نور القرآن</p>
          <p className="brand-caption">للحفظ والإتقان</p>
        </div>
      </header>
      <SurfaceCard>
        <p className="bootstrap-eyebrow">الأساس التقني — نسخة تجريبية</p>
        <h1 id="page-title">نبدأ رحلة القرآن على أساس متين</h1>
        <p className="bootstrap-lead">
          هذه واجهة تأسيسية للتحقق من التصميم العربي وتقسيم المكونات والاختبارات فقط.
          لا توجد حسابات أو حجوزات أو حصص حقيقية مفعّلة حتى الآن.
        </p>
        <p className="bootstrap-note">
          الصفحة التسويقية والتسجيل ولوحات الطالب والشيخ والإدارة ستُنفّذ في مهام مستقلة.
        </p>
      </SurfaceCard>
      <style>{`
        .bootstrap-main { width: min(100% - 32px, 800px); margin: 0 auto; padding: 44px 0 72px; }
        .bootstrap-brand { display: flex; align-items: center; gap: 16px; margin-bottom: 30px; }
        .brand-mark { color: var(--gold); font-size: 42px; line-height: 1; }
        .brand-title { margin: 0; color: var(--olive-2); font-family: 'Amiri', 'Noto Naskh Arabic', serif; font-size: 32px; font-weight: bold; line-height: 1.1; }
        .brand-caption { margin: 8px 0 0; color: var(--ink-2); font-size: 13px; }
        .bootstrap-eyebrow { margin: 0 0 16px; color: var(--gold-dark); font-weight: 700; font-size: 14px; }
        h1 { color: var(--olive-2); font-family: 'Amiri', 'Noto Naskh Arabic', serif; font-size: clamp(30px, 6vw, 46px); line-height: 1.4; margin: 0 0 20px; }
        .bootstrap-lead { font-size: 17px; margin: 0; max-width: 60ch; }
        .bootstrap-note { margin: 28px 0 0; border-right: 3px solid var(--gold); padding-right: 14px; color: var(--ink-2); font-size: 14px; }
        @media (max-width: 400px) { .bootstrap-main { padding-top: 24px; } }
      `}</style>
    </main>
  );
}
