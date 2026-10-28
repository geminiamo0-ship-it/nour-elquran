'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { ClassroomNotes, type LessonNote } from './ClassroomNotes';
import { useMushafDrawing } from './useMushafDrawing';

type Tool = 'highlight' | 'pen' | 'note';
const ayat = [
  'قُلْ هُوَ اللَّهُ أَحَدٌ ۝١', 'اللَّهُ الصَّمَدُ ۝٢',
  'لَمْ يَلِدْ وَلَمْ يُولَدْ ۝٣', 'وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ ۝٤',
] as const;
const initialNotes: LessonNote[] = [{ id: 0, author: 'الشيخ', text: 'راجع لفظ «الصمد» وكرر الآية مرتين.' }];

/** Isolated interactive mushaf mock. No licensed source, networking or server persistence. */
export function Classroom() {
  const [tool, setTool] = useState<Tool>('highlight');
  const [marked, setMarked] = useState<ReadonlySet<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [notes, setNotes] = useState<LessonNote[]>(initialNotes);
  const [noteText, setNoteText] = useState('');
  const [author, setAuthor] = useState<LessonNote['author']>('الطالب');
  const nextNoteId = useRef(0);
  const drawing = useMushafDrawing(tool === 'pen');

  function chooseVerse(index: number) {
    if (tool === 'highlight') {
      setMarked((current) => {
        const next = new Set(current);
        if (next.has(index)) next.delete(index); else next.add(index);
        return next;
      });
    } else if (tool === 'note') setSelected(index);
  }

  function verseKeyDown(event: KeyboardEvent<HTMLSpanElement>, index: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      chooseVerse(index);
    }
  }

  function clear() {
    setMarked(new Set());
    setSelected(null);
    setNotes([]);
    setNoteText('');
    setTool('highlight');
    drawing.clear();
  }

  function addNote() {
    const text = noteText.trim();
    if (!text) return;
    nextNoteId.current += 1;
    const prefix = selected === null ? '' : `«${ayat[selected]}»: `;
    setNotes((current) => [...current, { id: nextNoteId.current, author, text: prefix + text }]);
    setNoteText('');
  }

  const helper = tool === 'pen'
    ? 'ارسم بالقلم فوق المصحف بإصبعك أو بالماوس؛ الرسم هنا تجريبي فقط.'
    : tool === 'highlight' ? 'اضغط على أي آية لتظليلها.' : 'اضغط على الآية المطلوبة، ثم اكتب تعليقك على اليمين.';

  return (
    <section className="classroom-section" id="interactive-classroom">
      <div className="container">
        <div className="classroom-head-flex">
          <div className="section-heading"><span className="eyebrow">لِأَنَّ الحِصَّةَ أَكْثَرُ مِنْ مُكَالَمَة</span><h2>المصحفُ أمامكما، والحفظُ هدفكما.</h2><p>يحدّد الشيخ الكلمات، ويكتب الطالب ملاحظاته، وتبقى آثار التعلّم بعد انتهاء الحصة. جرّب الأدوات في النموذج المصغّر!</p></div>
          <span className="label-demo">معاينة واجهة فقط · بدون بث فعلي</span>
        </div>
        <div className="classroom-frame">
          <div className="classroom-toolbar"><span className="classroom-brand">✦ نور القرآن <span className="classroom-date">/ نموذج الفصل الذكي</span></span><span className="live-badge">● نموذج الفصل</span></div>
          <div className="classroom-body">
            <div className="board">
              <div className="board-head"><div><strong>سُورَةُ الإِخْلَاصِ</strong><span> · معاينة مصحف تفاعلي</span></div><span>صفحة تجريبية</span></div>
              <div className="board-content" id="boardSurface">
                <div className="board-label">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
                <div className="board-ayat" id="verseWords" aria-label="معاينة تفاعلية لآيات سورة الإخلاص">
                  {ayat.map((verse, index) => (
                    <span key={verse} className={['ayah', marked.has(index) ? 'marked' : '', selected === index ? 'selected' : ''].filter(Boolean).join(' ')} role="button" tabIndex={0} aria-pressed={marked.has(index) || selected === index} onClick={() => chooseVerse(index)} onKeyDown={(event) => verseKeyDown(event, index)}>{verse}</span>
                  ))}
                </div>
                <canvas className={tool === 'pen' ? 'ayat-overlay ink-enabled' : 'ayat-overlay'} id="drawingCanvas" ref={drawing.canvasRef} aria-label="طبقة رسم تجريبية فوق المصحف" onPointerDown={drawing.onPointerDown} onPointerMove={drawing.onPointerMove} onPointerUp={drawing.onPointerUp} onPointerCancel={drawing.onPointerUp} />
              </div>
              <div className="board-controls">
                <div className="tool-group" role="toolbar" aria-label="أدوات التعليم على المصحف">
                  {([['highlight', '✦ تظليل'], ['pen', '✎ قلم'], ['note', '▤ ملاحظة']] as const).map(([id, label]) => (
                    <button key={id} type="button" className={tool === id ? 'tool-btn active' : 'tool-btn'} data-tool={id} aria-pressed={tool === id} onClick={() => setTool(id)}>{label}</button>
                  ))}
                  <button type="button" className="tool-btn" data-tool="clear" onClick={clear}>↶ مسح الكل</button>
                </div>
                <button type="button" className="tool-btn text-only" id="printBoard" onClick={() => window.print()}>حفظ الصفحة PDF ↗</button>
              </div>
              <p className="board-helper" id="boardHelper">{helper}</p>
            </div>
            <ClassroomNotes notes={notes} noteText={noteText} author={author} onTextChange={setNoteText} onAuthorChange={setAuthor} onAdd={addNote} />
          </div>
        </div>
        <div className="after-class-bar">
          <div className="after-feature"><strong>يكتب الاثنان</strong><p>قلم وتظليل وملاحظات للشيخ وللطالب، مع تمييز صاحب التعليق.</p></div>
          <div className="after-feature"><strong>لا يضيع ما تعلّمتَه</strong><p>تظل العلامات في ملف الحصة، ويمكنك الرجوع لها عند المراجعة.</p></div>
          <div className="after-feature"><strong>صفحة محفوظة</strong><p>حفظ الصورة أو PDF في ملف الطالب بعد الحصة، إلى جانب تقرير الشيخ.</p></div>
        </div>
        <p className="demo-note"><strong>تنبيه:</strong> المصحف أعلاه مثال نصّي للتصميم فقط، لا يُستخدم كمصدر قرآني رسمي. عند التنفيذ نربطه بمصدر مصحف موثوق، ولا تُحفظ أي ملاحظات على خادم في هذه النسخة.</p>
      </div>
    </section>
  );
}
