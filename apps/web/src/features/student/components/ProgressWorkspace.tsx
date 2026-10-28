'use client';
import { useState } from 'react';
import { useStudent } from '../StudentContext';
import type { Grade } from '../domain';
import styles from '../StudentPortal.module.css';

type Criterion = 'all' | 'memorization' | 'recitation' | 'tajweed';
const criteria = [
  { id: 'all', label: 'الكل' }, { id: 'memorization', label: 'الحفظ' },
  { id: 'recitation', label: 'التلاوة' }, { id: 'tajweed', label: 'التجويد' },
] as const;
const grades = [
  { key: 'memorization', label: 'الحفظ' }, { key: 'recitation', label: 'التلاوة' },
  { key: 'tajweed', label: 'التجويد' },
] as const;
function GradeValue({ grade }: { grade: Grade }) {
  return <strong>{grade === null ? 'لم يُقيّم' : grade + ' / 10'}</strong>;
}
export function ProgressWorkspace() {
  const { selected } = useStudent();
  const [criterion, setCriterion] = useState<Criterion>('all');
  const reports = selected.reports.filter((report) => criterion === 'all' || report[criterion] !== null);
  return <div className={styles.workspace}>
    <section className={styles.panel}>
      <div className={styles.panelHead}><div><p className={styles.eyebrow}>تقارير معتمدة فقط</p><h2>السجل الأكاديمي</h2></div>
        <span className={styles.statusNeutral}>{selected.reports.length ? selected.reports.length + ' تقرير مثال' : 'لا تقارير'}</span></div>
      <p className={styles.panelIntro}>كل درجة من 10 مستقلة، ولا نعرض متوسطًا إجماليًا مصطنعًا أو نُحوّل «لم يُقيّم» إلى صفر.</p>
      <div className={styles.filterRow} role="group" aria-label="تصفية التقارير بحسب التقييم">
        {criteria.map((item) => <button type="button" key={item.id}
          className={criterion === item.id ? styles.filterActive : styles.filterButton}
          aria-pressed={criterion === item.id} onClick={() => setCriterion(item.id)}>{item.label}</button>)}
      </div>
      {reports.length ? <div className={styles.stack}>{reports.map((report) =>
        <article className={styles.formCard} key={report.id}>
          <div className={styles.reportTop}><div><strong>{report.dateLabel}</strong>
            <small>{report.teacher} · تقرير منشور في المعاينة</small></div>
            <span className={styles.statusSoft}>منشور · مثال</span></div>
          <div className={styles.reportGrades}>{grades.map(({ key, label }) => <div key={key}>
            <span>{label}</span><GradeValue grade={report[key]} />
          </div>)}</div>
          <div className={styles.reportValues}>
            <span>آيات حفظ أقرها المعلم: <strong>{report.memorizedAyat ?? '—'}</strong></span>
            <span>آيات تمت مراجعتها: <strong>{report.reviewedAyat ?? '—'}</strong></span></div>
          <details className={styles.detailItem}><summary>افتح تفاصيل تقرير الحصة</summary>
            <div className={styles.detailBody}>{report.summary}
              <p className={styles.muted}>ملاحظات مخارج الحروف والأخطاء والصور المؤرشفة تُضاف مع نظام تقارير الشيخ الحقيقي.</p>
            </div></details>
        </article>)}</div> :
        <div className={styles.emptyBox}>{selected.reports.length ? 'لا يوجد تقييم منشور لهذا المعيار بعد.' :
          'لا توجد تقارير منشورة أو معتمدة لهذا الطالب. ستظهر بعد أول حصة وتقييم من الشيخ.'}</div>}
    </section>
  </div>;
}
