import { ACCOUNT_UI_ENABLED } from '@/features/account';
export function DemoStrip() { return <div className="demo-strip">{ACCOUNT_UI_ENABLED ? 'الحسابات متاحة للاختبار · الحصص والاشتراكات غير مفعّلة بعد' : <>تصور تفاعلي لتصميم نور القرآن · <span>لا توجد حجوزات أو حسابات حقيقية في هذه النسخة</span></>}</div>; }
