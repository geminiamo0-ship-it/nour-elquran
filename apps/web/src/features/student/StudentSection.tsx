'use client';
import Link from 'next/link';
import { useStudent } from './StudentContext';
import { SchedulePanel } from './components/SchedulePanel';
import { WirdPanel } from './components/WirdPanel';
import styles from './StudentPortal.module.css';

export const sections = {
  lessons: { title: 'حصصي وجدولي', caption: 'مواعيد الحصص وحالتها في عرض أسبوعي واضح' },
  mushaf: { title: 'المصحف', caption: 'مساحة تلاوة واستكشاف دون ادعاء حفظ أو تقييم' },
  training: { title: 'تدريباتي', caption: 'الورد والتكرار الذي يعتمده الشيخ فقط' },
  progress: { title: 'تقدمي وتقاريري', caption: 'درجات الحفظ والتلاوة والتجويد كلٌّ على حدة' },
  notebook: { title: 'دفتر الحصص', caption: 'ملاحظات وتقارير الجلسات التعليمية' },
  subscription: { title: 'الاشتراك', caption: 'حالة الاشتراك والرصيد، بعد تفعيل الدفع الآمن' },
  account: { title: 'الحساب', caption: 'إعدادات الحساب واختيار ملفات الطلاب' },
} as const;
export type StudentSectionName = keyof typeof sections;

function LearningReport() {
  const { selected } = useStudent();
  if (!selected.reports.length) return <div className={styles.emptyBox}>
    <h2>لا توجد تقارير منشورة بعد</h2>
    <p>بعد الحصة الأولى، يظهر التقرير المُعتمَد من الشيخ هنا. عدم وجود تقييم لا يعني الحصول على صفر.</p>
  </div>;
  return <div className={styles.reportStack}>{selected.reports.map((report) => <article className={styles.reportCard} key={report.id}>
    <div className={styles.reportTop}><div><strong>{report.dateLabel}</strong><small>{report.teacher} · تقرير منشور في المعاينة</small></div><span className={styles.statusSoft}>منشور · مثال</span></div>
    <div className={styles.reportGrades}>{([
      ['الحفظ', report.memorization], ['التلاوة', report.recitation], ['التجويد', report.tajweed],
    ] as const).map(([name, score]) => <div key={name}><span>{name}</span><strong>{score === null ? 'لم يُقيّم' : String(score) + ' / 10'}</strong></div>)}</div>
    <div className={styles.reportValues}><span>آيات الحفظ المثبتة: <strong>{report.memorizedAyat ?? '—'}</strong></span>
      <span>آيات المراجعة: <strong>{report.reviewedAyat ?? '—'}</strong></span></div>
    <p>{report.summary}</p>
  </article>)}</div>;
}

export function StudentSection({ section }: { section: StudentSectionName }) {
  const { selected } = useStudent();
  const meta = sections[section];
  return <div>
    <header className={styles.pageHeader}><div><p className={styles.eyebrow}>مساحتي التعليمية / {meta.title}</p><h1>{meta.title}</h1><p>{meta.caption}</p></div></header>
    {section === 'lessons' && <div className={styles.fullPanel}><SchedulePanel detailed />
      <div className={styles.infoNote}>دخول الفصل وإعادة الجدولة والغياب لن تعمل إلا بعد التحقق من الموعد الحقيقي وصلاحيات الطالب.</div></div>}
    {section === 'training' && <div className={styles.fullPanel}><WirdPanel detailed /></div>}
    {section === 'mushaf' && <section className={styles.panel}>
      <div className={styles.mushafOrnament} aria-hidden="true">۞</div>
      <p className={styles.eyebrow}>المصحف والتلاوة</p><h2>المصحف المعتمد سيكون هنا</h2>
      <p>سنربط المصحف بنص قرآني موثّق وطبعة مرخّصة قبل إتاحته للدراسة الفعلية. لا نعرض نصًا توليديًا على أنه المصحف الرسمي، ولا نسجّل تقدّمًا غير معتمد.</p>
      <Link href="/#interactive-classroom" className={styles.goldButton}>جرّب أدوات الفصل التفاعلي</Link>
      <p className={styles.muted}>معاينة الرسم والتظليل فقط؛ لا يوجد بث أو أرشيف محفوظ على خادم.</p>
    </section>}
    {section === 'progress' && <div className={styles.fullPanel}>
      <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.eyebrow}>تقييم الشيخ</p><h2>مقاييس أكاديمية منفصلة</h2></div></div>
        <p className={styles.panelIntro}>الحفظ والتلاوة والتجويد درجات مستقلة من 10، ولا نجمعها في درجة واحدة. الغياب عن التقييم يظهر «لم يُقيّم».</p>
        <LearningReport />
      </section>
    </div>}
    {section === 'notebook' && <section className={styles.panel}>
      <p className={styles.eyebrow}>أرشيف الحصص</p><h2>ملاحظات الشيخ وصفحات المصحف</h2>
      {selected.reports.length ? <div className={styles.noteSheet}>
        <strong>ملاحظات التقرير المنشور · مثال توضيحي</strong>
        <p>{selected.latestReport?.summary}</p>
        <p className={styles.muted}>لا توجد صور مصحف أو ملفات PDF مؤرشفة في هذه النسخة التجريبية.</p>
      </div> : <div className={styles.emptyBox}>لم تُحفَظ أي حصة لهذا الملف بعد. ستجد أرشيفك الخاص بعد انتهاء الدروس ونشر التقارير.</div>}
      <p className={styles.panelFoot}>أرشيف كل طالب سيكون منفصلًا وتخضع الملفات الخاصة للصلاحيات عند تفعيل الخدمة.</p>
    </section>}
    {section === 'subscription' && <section className={styles.panel}>
      <p className={styles.eyebrow}>إدارة الاشتراك</p><h2>لا توجد اشتراكات فعلية في المعاينة</h2>
      <div className={styles.emptyBox}>حالة الطالب التجريبية: {selected.profile.stage === 'active' ? 'نشط (بيانات توضيحية)' : 'لا يوجد اشتراك مؤكد'}. لن يظهر رصيد أو تاريخ انتهاء مختلق، ولن يُخصم أي مبلغ.</div>
      <p className={styles.panelFoot}>اختيار الباقات ووسائل الدفع والرصيد التعويضي سيأتي بعد اعتماد السياسات وربط Backend آمن.</p>
    </section>}
    {section === 'account' && <section className={styles.panel}>
      <p className={styles.eyebrow}>ملفات حساب الأسرة</p><h2>الملف الحالي: {selected.profile.name}</h2>
      <p className={styles.panelIntro}>يمكنك التنقل بين الطلاب من القائمة أعلى الصفحة. لكل ملف حصصه وواجباته وتقاريره بصورة مستقلة.</p>
      <div className={styles.noteSheet}>لا يوجد تسجيل دخول أو كلمة مرور أو هاتف محفوظ على خادم. هذه معاينة ببيانات محلية فقط، أما التحقق من ولي الأمر والصلاحيات فيأتي في مرحلة Supabase Auth.</div>
      <Link href="/" className={styles.outlineButton}>العودة إلى الصفحة الرئيسية</Link>
    </section>}
  </div>;
}
