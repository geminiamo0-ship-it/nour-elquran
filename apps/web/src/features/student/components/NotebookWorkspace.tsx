'use client';
import { useState, type FormEvent } from 'react';
import { useStudent } from '../StudentContext';
import styles from '../StudentPortal.module.css';
import {ConnectedNotebookWorkspace} from './ConnectedNotebookWorkspace';

export function NotebookWorkspace() {
  const { selected, notes, addNote, removeNote } = useStudent();
  const completed = selected.lessons.filter((lesson) => lesson.status === 'completed');
  const [picked, setPicked] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const lessonId = completed.some((item) => item.id === picked) ? picked : completed[0]?.id ?? '';
  const lesson = completed.find((item) => item.id === lessonId);
  const report = selected.reports.find((item) => item.lessonId === lessonId);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!addNote(lessonId, draft)) { setError('اكتب ملاحظة لا تزيد على 500 حرف لحصة مكتملة.'); return; }
    setDraft('');
    setError('');
  }
  if(!selected.profile.demo)return <ConnectedNotebookWorkspace learnerId={selected.profile.id}/>;
  return <div className={styles.workspace}>
    <section className={styles.panel}>
      <div className={styles.panelHead}><div><p className={styles.eyebrow}>ذاكرة الحصة</p><h2>دفتر الطالب الخاص</h2></div></div>
      <p className={styles.panelIntro}>لكل طالب دفتر مستقل. الملاحظات التي تكتبها هنا محلية ومؤقتة وليست تصحيحًا لتقرير الشيخ أو أرشيفًا سحابيًا.</p>
      {lesson ? <>
        <label className={styles.formLabel} htmlFor="notebook-lesson">اختر حصة مكتملة</label>
        <select id="notebook-lesson" className={styles.selectField} value={lessonId}
          onChange={(event) => { setPicked(event.target.value); setDraft(''); setError(''); }}>
          {completed.map((item) => <option key={item.id} value={item.id}>{item.topic} · {item.time}</option>)}
        </select>
        <div className={styles.noteSheet}>
          <strong>{lesson.topic} · {lesson.teacher}</strong>
          <p>{report?.summary ?? 'لم يُنشر تقرير من الشيخ لهذه الحصة بعد.'}</p>
          <p className={styles.muted}>لا توجد نسخة PDF أو صورة مصحف محفوظة لهذه الحصة في النموذج الحالي.</p>
        </div>
        <div className={styles.stack}>
          {notes.filter((note) => note.lessonId === lessonId).map((note) =>
            <article className={styles.personalNote} key={note.id}>
              <p>{note.text}</p><button type="button" className={styles.textButton} onClick={() => removeNote(note.id)}>حذف الملاحظة</button>
            </article>)}
        </div>
        <form onSubmit={submit} className={styles.formCard}>
          <label className={styles.formLabel} htmlFor="notebook-draft">أضف ملاحظة شخصية لهذه الحصة</label>
          <textarea id="notebook-draft" rows={4} className={styles.textArea} maxLength={500}
            placeholder="مثال: أراجع أحكام النون الساكنة قبل الحصة القادمة" value={draft}
            onChange={(event) => setDraft(event.target.value)} />
          <div className={styles.actionRow}><span className={styles.muted}>{draft.length} / 500</span>
            <button type="submit" className={styles.actionButton}>احفظ محليًا</button></div>
          {error && <p role="alert" className={styles.formError}>{error}</p>}
        </form>
      </> : <div className={styles.emptyBox}>لا توجد حصص مكتملة لهذا الطالب بعد. سيظهر دفتر الحصص بعد أول لقاء.</div>}
    </section>
  </div>;
}
