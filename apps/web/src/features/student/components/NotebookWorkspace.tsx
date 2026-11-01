'use client';
import {useState,type FormEvent} from 'react';
import {useStudent} from '../StudentContext';
import {ConnectedNotebookWorkspace} from './ConnectedNotebookWorkspace';
import css from './LessonsPremium.module.css';

export function NotebookWorkspace(){
 const {selected,notes,addNote,removeNote}=useStudent();
 const completed=selected.lessons.filter(l=>l.status==='completed');
 const [picked,setPicked]=useState('');
 const [draft,setDraft]=useState('');
 const [error,setError]=useState('');
 const lessonId=completed.some(l=>l.id===picked)?picked:completed[0]?.id??'';
 const lesson=completed.find(l=>l.id===lessonId);
 const report=selected.reports.find(r=>r.lessonId===lessonId);
 if(!selected.profile.demo)return <ConnectedNotebookWorkspace learnerId={selected.profile.id}/>;
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!addNote(lessonId,draft)){setError('اكتب ملاحظة لا تزيد على 500 حرف.');return;}
  setDraft('');setError('');
 }
 return <section className={css.panel} aria-label="سجل الحصص">
  <div className={css.panelHead}><h2>سجل حصصي</h2><small>بيانات معاينة</small></div>
  {!lesson?<p className={css.reportEmpty}>لا توجد حصص مكتملة حتى الآن. سيظهر سجل الحصة بعد انتهائها.</p>:<>
   {completed.length>1&&<>
    <label className={css.fieldLabel} htmlFor="preview-lesson">اختر الحصة</label>
    <select id="preview-lesson" className={css.chooser} value={lessonId}
     onChange={e=>{setPicked(e.target.value);setDraft('');setError('');}}>
     {completed.map(l=><option key={l.id} value={l.id}>{l.topic} · {l.time}</option>)}
    </select>
   </>}
   <div className={css.noteCard}>
    <h2>{lesson.topic}</h2>
    <p className={css.reportSummary}>{lesson.teacher} · {lesson.time}</p>
    <p className={css.reportSummary}>{report?.summary??'لم ينشر الشيخ تقريرًا لهذه الحصة بعد.'}</p>
   </div>
   <div className={css.noteCard}>
    <h2>ملاحظاتي</h2>
    {notes.filter(n=>n.lessonId===lessonId).map(n=>
     <article className={css.savedNote} key={n.id}>
      <p>{n.text}</p>
      <button className={css.textButton} type="button" onClick={()=>removeNote(n.id)}>حذف</button>
     </article>)}
    <form onSubmit={submit}>
     <label className={css.fieldLabel} htmlFor="preview-note">أضف ملاحظة لهذه الحصة</label>
     <textarea className={css.noteInput} id="preview-note" rows={3} maxLength={500}
      value={draft} onChange={e=>setDraft(e.target.value)}
      placeholder="ما الذي تريد مراجعته؟"/>
     <div className={css.noteActions}>
      <span className={css.previewFoot}>تُحفظ الملاحظات محليًا في المعاينة فقط.</span>
      <button className={css.detailsButton} type="submit">حفظ الملاحظة</button>
     </div>
     {error&&<p role="alert">{error}</p>}
    </form>
   </div>
  </>}
 </section>;
}
