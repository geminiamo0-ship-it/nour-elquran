'use client';
import Link from 'next/link';
import { useStudent } from '../StudentContext';
import styles from '../StudentPortal.module.css';

export function WirdPanel({ detailed = false }: { detailed?: boolean }) {
  const { selected, finished, toggleTask } = useStudent();
  return <section className={styles.panel} aria-labelledby="wird-panel-heading">
    <div className={styles.panelHead}>
      <div><span className={styles.eyebrow}>الورد اليومي</span><h2 id="wird-panel-heading">الحفظ والمراجعة</h2></div>
      {!detailed && <Link href="/student/training" className={styles.inlineLink}>كل التدريبات ‹</Link>}
    </div>
    {selected.tasks.length ? <>
      <p className={styles.panelIntro}>هذه المهام المعتمدة مثال تعليمي. العلامات التي تضعها محلية للمعاينة ولا تصبح تقييمًا من الشيخ.</p>
      <div className={styles.taskList}>{selected.tasks.map((task) =>
        <label key={task.id} className={styles.taskRow}>
          <input type="checkbox" checked={finished.includes(task.id)} onChange={() => toggleTask(task.id)}
            aria-label={'اكتمل: ' + task.title} />
          <span className={styles.taskCopy}><strong>{task.title}</strong><span>{task.scope}</span>
            {task.repetitions !== null && <small>التكرار المقترح: {task.repetitions} مرات</small>}
          </span>
        </label>)}</div>
      <div className={styles.taskSummary}><span>إنجاز محلي للمعاينة</span><strong>{finished.length} من {selected.tasks.length} مهام</strong></div>
      <div className={styles.taskProgress} aria-label="نسبة إنجاز المهام في هذه المعاينة"><div style={{ width: String(Math.round(100 * finished.length / selected.tasks.length)) + '%' }} /></div>
    </> : <div className={styles.emptyBox}>
      <p>لم يحدد الشيخ وردًا شخصيًا لهذا الطالب بعد.</p>
      <p className={styles.muted}>يمكنك استكشاف المصحف، لكن ذلك ليس واجبًا معتمدًا ولا يدخل في تقييم الحفظ.</p>
      <Link href="/student/mushaf" className={styles.outlineButton}>استكشف المصحف</Link>
    </div>}
    <div className={styles.panelFoot}>الحفظ الحقيقي وتقييم التلاوة يعتمدهما الشيخ فقط.</div>
  </section>;
}
