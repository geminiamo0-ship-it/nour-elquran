'use client';

import type { ChangeEvent } from 'react';

export type LessonNote = Readonly<{ id: number; author: 'الشيخ' | 'الطالب'; text: string }>;
type Props = Readonly<{
  notes: readonly LessonNote[];
  noteText: string;
  author: LessonNote['author'];
  onTextChange: (value: string) => void;
  onAuthorChange: (value: LessonNote['author']) => void;
  onAdd: () => void;
}>;

export function ClassroomNotes({ notes, noteText, author, onTextChange, onAuthorChange, onAdd }: Props) {
  return (
    <aside className="class-sidebar">
      <div className="video-tiles">
        <div className="video-tile"><div className="avatar">م</div><small>الشيخ · نموذج</small></div>
        <div className="video-tile student"><div className="avatar">أ</div><small>الطالب · نموذج</small></div>
      </div>
      <div className="class-notes">
        <h4>ملاحظات الحصة</h4>
        <p>حدد أي آية ثم أضف تعليقًا بسيطًا بجانب المصحف.</p>
        <div id="lessonNotes" aria-live="polite">
          {notes.map((note) => <div className="note-entry" key={note.id}><b>{note.author}</b><span>{note.text}</span></div>)}
        </div>
      </div>
      <div className="notes-add">
        <label htmlFor="lessonNoteText">أضف ملاحظة تجريبية</label>
        <textarea id="lessonNoteText" maxLength={150} placeholder="مثال: أراجع آخر آيتين قبل الحصة القادمة..." value={noteText} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onTextChange(event.target.value)} />
        <div className="note-add-row">
          <select id="noteAuthor" aria-label="كاتب الملاحظة" value={author} onChange={(event) => onAuthorChange(event.target.value as LessonNote['author'])}><option>الطالب</option><option>الشيخ</option></select>
          <button type="button" className="tool-btn active" id="addNote" onClick={onAdd}>إضافة +</button>
        </div>
      </div>
    </aside>
  );
}
