'use client';
import Link from 'next/link';
import { useStudent } from './StudentContext';
import { SchedulePanel } from './components/SchedulePanel';
import { WirdPanel } from './components/WirdPanel';
import {ConnectedStudentDashboard} from './ConnectedStudentDashboard';
import styles from './StudentPortal.module.css';

const stages = {
  new: { heading: 'بداية رحلتك مع القرآن', message: 'ملف الطالب جاهز للاستكشاف. الحجز الفعلي غير متاح في المعاينة؛ ستختار الموعد بعد تفعيل النظام.' },
  trial_booked: { heading: 'استعد للحصة التعريفية', message: 'الحصة المعروضة هنا مثال فقط، وليست حجزًا حقيقيًا أو تعيينًا لشيخ.' },
  assessed: { heading: 'تقريرك الأكاديمي', message: 'اطّلع على تقييم المعلم المنشور قبل بدء برنامجك.' },
  active: { heading: 'خطة التعلم لهذا الأسبوع', message: 'تابع موعدك والورد المعتمد من الشيخ. جميع البيانات الظاهرة في هذه المعاينة أمثلة.' },
  lapsed: { heading: 'استئناف رحلة التعلم', message: 'المواعيد والرصيد الفعلي يتحددان بعد تفعيل الاشتراكات.' },
} as const;

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className={styles.metric}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

export function StudentDashboard() {
  const { selected, finished } = useStudent();
  const { profile, lessons, tasks, latestReport } = selected;
  if(!profile.demo)return <ConnectedStudentDashboard key={profile.id} learnerId={profile.id} name={profile.name}/>;
  const status = stages[profile.stage];
  return <>
    <div className={styles.pageHeader}>
      <div><p className={styles.eyebrow}>لوحة الطالب / مساحة التعلم</p>
        <h1>السلام عليكم، {profile.name}</h1>
        <p>جدولك ووردك اليومي في مكان واحد، بكل وضوح وطمأنينة.</p></div>
      <span className={styles.headerDecoration} aria-hidden="true">بِسْمِ اللَّهِ</span>
    </div>
    <section className={styles.contextStrip} aria-label="الخطوة التالية">
      <div><span className={styles.smallOverline}>خطوتك التالية</span><h2>{status.heading}</h2><p>{profile.demo ? status.message : 'ملف الطالب جاهز. ستظهر هنا مواعيدك وتكليفات الشيخ وتقاريرك عند تفعيل خدمات التعلم.'}</p></div>
      {profile.stage === 'new' ?
        <Link href="/student/lessons#trial-booking" className={styles.goldButton}>استكشف الحجز التجريبي</Link> :
        <Link href="/student/lessons" className={styles.goldButton}>عرض جدول الحصص</Link>}
    </section>
    <section className={styles.metricGrid} aria-label="الملخص الأكاديمي">
      <Metric label="الحصص القادمة" value={lessons.filter((item) => item.status === 'booked' && item.dayOffset >= 0).length ? String(lessons.filter((item) => item.status === 'booked' && item.dayOffset >= 0).length) : '—'} detail={profile.demo ? 'أمثلة عند وجود حصص' : 'لا توجد مواعيد متاحة بعد'} />
      <Metric label="الورد المعتمد" value={tasks.length ? String(tasks.length) : '—'} detail="مهام اعتمدها الشيخ" />
      <Metric label="تمّ في هذه المعاينة" value={tasks.length ? String(finished.length) + ' / ' + String(tasks.length) : '—'} detail="متابعة محلية غير مُرسلة" />
      <Metric label="آخر تقييم منشور" value={latestReport ? 'متاح' : '—'} detail="ثلاث درجات مستقلة من ١٠" />
    </section>
    <div className={styles.primaryGrid}>
      <SchedulePanel />
      <WirdPanel />
    </div>
    <div className={styles.secondaryGrid}>
      <section className={styles.panel}>
        <div className={styles.panelHead}><div><span className={styles.eyebrow}>التقدّم الأكاديمي</span><h2>آخر تقرير معتمد</h2></div><Link href="/student/progress" className={styles.inlineLink}>جميع التقارير ‹</Link></div>
        {latestReport ? <>
          <div className={styles.gradeRow}>{([
            ['الحفظ', latestReport.memorization], ['التلاوة', latestReport.recitation], ['التجويد', latestReport.tajweed],
          ] as const).map(([label, value]) => <div className={styles.grade} key={label}><span>{label}</span><strong>{value === null ? 'لم يُقيّم' : String(value) + ' / 10'}</strong></div>)}</div>
          <p className={styles.reportNote}>{latestReport.summary}</p>
          <p className={styles.muted}>بيانات تقييم توضيحية، وليست نتائج طالب حقيقي.</p>
        </> : <div className={styles.emptyBox}>لم يُنشَر أي تقرير بعد. ستظهر تقييمات الشيخ هنا بعد أول حصة وتوثيقها.</div>}
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHead}><div><span className={styles.eyebrow}>من دفترك</span><h2>ملاحظات الحصص</h2></div><Link href="/student/notebook" className={styles.inlineLink}>دفتر الحصص ‹</Link></div>
        <div className={styles.notebookPreview}><span aria-hidden="true">۞</span><div><h3>المصحف والملاحظات</h3><p>بعد الحصة، تجد ملاحظات الشيخ والصفحات المؤشّر عليها هنا. لا توجد ملفات حقيقية في النموذج.</p><Link href="/student/mushaf">استكشف المصحف ←</Link></div></div>
      </section>
    </div>
  </>;
}

