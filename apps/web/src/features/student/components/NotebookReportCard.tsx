import type { Lesson, PublishedReport } from '../domain';
import styles from '../StudentPortal.module.css';

function gradeLabel(grade: number | null): string {
  return grade === null ? 'لم يُقيَّم' : grade + ' / 10';
}

/** Report-only interim view; never implies a saved Quran annotation or PDF archive. */
export function NotebookReportCard({ lesson, report }: { lesson: Lesson; report: PublishedReport | null }) {
  return <div className={styles.noteSheet}>
    <strong>{lesson.topic} · {lesson.teacher}</strong>
    {report ? <>
      <p>{report.summary}</p>
      <p className={styles.muted}>التقييم المنشور: الحفظ {gradeLabel(report.memorization)} · التلاوة {gradeLabel(report.recitation)} · التجويد {gradeLabel(report.tajweed)}</p>
    </> : <p role="status">تقرير الشيخ لم يُنشر لهذه الحصة بعد. لا توجد درجات معتمدة للعرض.</p>}
    <p className={styles.muted}>طبقة علامات الحصة المعتمدة، والمشاركة والتصدير والأرشيف غير متاحة في هذه النسخة. الملاحظات الشخصية أدناه محلية فقط.</p>
  </div>;
}
