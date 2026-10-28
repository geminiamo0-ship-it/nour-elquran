'use client';

import { Fragment, useId, useMemo, useState } from 'react';
import { useStudent } from '../StudentContext';
import { AttendanceWorkspace } from './AttendanceWorkspace';
import type { Grade, PublishedReport } from '../domain';
import { latestPublishedReports, REPORTS_PAGE_SIZE, nextReportCount } from '../reportHistory';
import styles from '../StudentPortal.module.css';
import table from './ProgressTable.module.css';

function GradeCell({ value }: { value: Grade }) {
  return <>{value === null ? 'لم يُقيّم' : value + ' / 10'}</>;
}

function Details({ report }: { report: PublishedReport }) {
  return <div className={table.details}>
    <p><strong>تقرير الحصة:</strong> {report.dateLabel} · {report.teacher}</p>
    <div className={table.gradeList}>
      <span>الحفظ: <GradeCell value={report.memorization} /></span>
      <span>التلاوة: <GradeCell value={report.recitation} /></span>
      <span>التجويد: <GradeCell value={report.tajweed} /></span>
    </div>
    <p>آيات الحفظ المثبتة: <strong>{report.memorizedAyat ?? 'غير مذكور'}</strong></p>
    <p>آيات المراجعة: <strong>{report.reviewedAyat ?? 'غير مذكور'}</strong></p>
    <p className={table.feedback}>{report.summary}</p>
    <p className={table.unavailable}>المصحف المشروح للحصة غير متوفر في المعاينة؛ لن نعرض رابط أرشيف غير موجود.</p>
  </div>;
}

export function ProgressWorkspace() {
  const { selected } = useStudent();
  const reports = useMemo(
    () => latestPublishedReports(selected.reports, selected.profile.id),
    [selected.reports, selected.profile.id],
  );
  // The StudentSection keys the component by learnerId: pagination/expansion reset on sibling change.
  const [count, setCount] = useState(REPORTS_PAGE_SIZE);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const idPrefix = useId().replaceAll(':', '');
  const visible = reports.slice(0, count);

  return <div className={styles.workspace}>
    <section className={styles.panel} aria-labelledby="academic-history-heading">
      <div className={styles.panelHead}>
        <div><p className={styles.eyebrow}>التقارير المنشورة فقط</p><h2 id="academic-history-heading">السجل الأكاديمي</h2></div>
        <span className={styles.statusNeutral}>{reports.length ? reports.length + ' تقرير توضيحي' : 'لا توجد تقارير'}</span>
      </div>
      <p className={styles.panelIntro}>
        ثلاث درجات مستقلة من 10، دون متوسط كلي أو رسوم بيانية. «لم يُقيّم» ليست صفرًا.
        هذه أمثلة وليست درجات حقيقية.
      </p>
      {reports.length === 0 ? <div className={styles.emptyBox}>
        لا توجد تقارير منشورة أو معتمدة لهذا الطالب. ستظهر بعد أول حصة وتقييم من الشيخ.
      </div> : <>
        <div className={table.scroll} tabIndex={0} role="region" aria-label="جدول التقارير الأكاديمية">
          <table className={table.table}>
            <thead><tr>
              <th scope="col">الحصة / التاريخ</th>
              <th scope="col">الحفظ / 10</th>
              <th scope="col">التلاوة / 10</th>
              <th scope="col">التجويد / 10</th>
              <th scope="col">التقرير</th>
            </tr></thead>
            <tbody>
              {visible.map((report) => {
                const expanded = expandedId === report.id;
                const detailId = idPrefix + '-report-' + report.id;
                return <Fragment key={report.id}>
                  <tr>
                    <th scope="row" className={table.lessonColumn}>
                      <strong>{report.dateLabel}</strong>
                      <small>{report.teacher}</small>
                    </th>
                    <td><GradeCell value={report.memorization} /></td>
                    <td><GradeCell value={report.recitation} /></td>
                    <td><GradeCell value={report.tajweed} /></td>
                    <td>
                      <button type="button" className={table.expand} aria-expanded={expanded} aria-controls={detailId}
                        onClick={() => setExpandedId(expanded ? null : report.id)}>
                        {expanded ? 'إخفاء التفاصيل' : 'عرض التقرير'}
                      </button>
                    </td>
                  </tr>
                  <tr className={table.detailsRow} hidden={!expanded}>
                    <td colSpan={5} id={detailId}><Details report={report} /></td>
                  </tr>
                </Fragment>;
              })}
            </tbody>
          </table>
        </div>
        {count < reports.length && <div className={table.more}>
          <button type="button" className={styles.actionButton}
            onClick={() => setCount((current) => nextReportCount(current, reports.length))}>عرض المزيد</button>
        </div>}
        <p className={styles.panelFoot}>كل حصة تظهر بإصدارها المنشور الأحدث فقط، ولا تُعرض مسودات الشيخ.</p>
      </>}
    </section>
    <AttendanceWorkspace />
  </div>;
}
