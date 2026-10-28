'use client';
import { useStudent } from '../StudentContext';
import { WirdPanel } from './WirdPanel';
import styles from '../StudentPortal.module.css';

export function TrainingWorkspace() {
  const { selected, taskDrafts, preparedTasks, updateTaskDraft, markTaskPrepared } = useStudent();
  return <div className={styles.workspace}>
    <WirdPanel detailed />
    <section className={styles.panel}>
      <div className={styles.panelHead}><div><p className={styles.eyebrow}>التحضير قبل التسميع</p><h2>تجهيز الواجب للمراجعة</h2></div></div>
      <p className={styles.panelIntro}>اكتب ملاحظاتك على المهمة ثم راجعها قبل تجهيزها. زر «جهّز للمراجعة» لا يرسل نصًا أو صوتًا للشيخ؛ هو نموذج محلي لمسار التسليم.</p>
      {selected.tasks.length ? <div className={styles.stack}>
        {selected.tasks.map((task) => <article key={task.id} className={styles.formCard}>
          <div className={styles.reportTop}><div><strong>{task.title}</strong><small>{task.scope}</small></div>
            <span className={styles.statusNeutral}>{preparedTasks.includes(task.id) ? 'مُجهز محليًا' : 'مسودة'}</span></div>
          <label className={styles.formLabel} htmlFor={'draft-' + task.id}>ملاحظة الطالب عن التدريب</label>
          <textarea id={'draft-' + task.id} maxLength={500} rows={3}
            placeholder="ما الذي احتجت لمراجعته؟" value={taskDrafts[task.id] ?? ''}
            onChange={(event) => updateTaskDraft(task.id, event.target.value)} className={styles.textArea} />
          <div className={styles.actionRow}>
            <span className={styles.muted}>حتى 500 حرف، لن تُحفظ على الخادم.</span>
            <button type="button" disabled={!(taskDrafts[task.id] ?? '').trim() || preparedTasks.includes(task.id)}
              className={styles.actionButton} onClick={() => markTaskPrepared(task.id)}>
              {preparedTasks.includes(task.id) ? 'تم التجهيز ✓' : 'جهّز للمراجعة'}</button>
          </div>
          {preparedTasks.includes(task.id) && <p role="status" className={styles.infoNote}>تم تجهيز المسودة داخل الصفحة فقط؛ لم يتم تسليم واجب أو تسجيل صوتي.</p>}
        </article>)}
      </div> : <div className={styles.emptyBox}>لا توجد تكليفات معتمدة من شيخ لهذا الطالب. يمكنك استكشاف المصحف دون نسبتها إلى واجب رسمي.</div>}
    </section>
  </div>;
}
