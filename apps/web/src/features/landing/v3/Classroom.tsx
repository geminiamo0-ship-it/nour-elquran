'use client';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';

type Tool = 'highlight' | 'pen' | 'note';
type Note = { id: number; author: string; text: string };
const verses = [
  'قُلْ هُوَ اللَّهُ أَحَدٌ ۝١', 'اللَّهُ الصَّمَدُ ۝٢',
  'لَمْ يَلِدْ وَلَمْ يُولَدْ ۝٣', 'وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ ۝٤',
];

export function Classroom() {
  const [tool, setTool] = useState<Tool>('highlight');
  const [marked, setMarked] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [notes, setNotes] = useState<Note[]>([{ id: 0, author: 'الشيخ', text: 'راجع لفظ «الصمد» وكرر الآية مرتين.' }]);
  const [noteText, setNoteText] = useState('');
  const [author, setAuthor] = useState('الطالب');
  const noteId = useRef(1);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const resizeBoard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.getBoundingClientRect();
    if (size.width < 1 || size.height < 1) return;
    const previous = canvas.width ? canvas.toDataURL() : '';
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.strokeStyle = '#b18327';
    ctx.fillStyle = '#b18327';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.2;
    if (previous && previous !== 'data:,') {
      const img = new Image();
      img.onload = () => { if (canvasRef.current === canvas) ctx.drawImage(img, 0, 0, size.width, size.height); };
      img.src = previous;
    }
  }, []);
  useEffect(() => {
    const frame = window.requestAnimationFrame(resizeBoard);
    const observer = new ResizeObserver(resizeBoard);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); };
  }, [resizeBoard]);

  function selectVerse(index: number) {
    if (tool === 'highlight') setMarked((old) => old.includes(index) ? old.filter((value) => value !== index) : [...old, index]);
    if (tool === 'note') { setSelected(index); noteRef.current?.focus(); }
  }
  function clearBoard() {
    setMarked([]); setSelected(null); setNotes([]); setNoteText(''); setTool('highlight');
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) { ctx.save(); ctx.resetTransform(); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore(); }
  }
  function position(event: PointerEvent<HTMLCanvasElement>) {
    const r = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  }
  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (tool !== 'pen') return;
    const canvas = event.currentTarget;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawing.current = true;
    last.current = position(event);
    canvas.setPointerCapture(event.pointerId);
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || tool !== 'pen' || !last.current) return;
    const ctx = event.currentTarget.getContext('2d');
    if (!ctx) return;
    const next = position(event);
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(next.x, next.y); ctx.stroke();
    last.current = next;
  }
  function stopDrawing() { drawing.current = false; last.current = null; }
  function addNote() {
    const text = noteText.trim();
    if (!text) { noteRef.current?.focus(); return; }
    setNotes((old) => [...old, { id: noteId.current++, author, text: (selected === null ? '' : `«${verses[selected]}»: `) + text }]);
    setNoteText('');
  }

  return (<section className="classroom-section" id="interactive-classroom">

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
                  <span className={`ayah${marked.includes(0) ? " marked" : ""}${selected === 0 ? " selected" : ""}`} role="button" tabIndex={0} onClick={() => selectVerse(0)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectVerse(0); } }}>قُلْ هُوَ اللَّهُ أَحَدٌ ۝١</span><span className={`ayah${marked.includes(1) ? " marked" : ""}${selected === 1 ? " selected" : ""}`} role="button" tabIndex={0} onClick={() => selectVerse(1)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectVerse(1); } }}>اللَّهُ الصَّمَدُ ۝٢</span><span className={`ayah${marked.includes(2) ? " marked" : ""}${selected === 2 ? " selected" : ""}`} role="button" tabIndex={0} onClick={() => selectVerse(2)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectVerse(2); } }}>لَمْ يَلِدْ وَلَمْ يُولَدْ ۝٣</span><span className={`ayah${marked.includes(3) ? " marked" : ""}${selected === 3 ? " selected" : ""}`} role="button" tabIndex={0} onClick={() => selectVerse(3)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectVerse(3); } }}>وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ ۝٤</span>
                </div>
                <canvas ref={canvasRef} className={tool === "pen" ? "ayat-overlay ink-enabled" : "ayat-overlay"} id="drawingCanvas" aria-label="طبقة رسم تجريبية فوق المصحف" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} onLostPointerCapture={stopDrawing}></canvas>
              </div>
              <div className="board-controls">
                <div className="tool-group" role="toolbar" aria-label="أدوات التعليم على المصحف">
                  <button type="button" className={tool === "highlight" ? "tool-btn active" : "tool-btn"} data-tool="highlight" aria-pressed={tool === "highlight"} onClick={() => setTool("highlight")}>✦ تظليل</button>
                  <button type="button" className={tool === "pen" ? "tool-btn active" : "tool-btn"} data-tool="pen" aria-pressed={tool === "pen"} onClick={() => setTool("pen")}>✎ قلم</button>
                  <button type="button" className={tool === "note" ? "tool-btn active" : "tool-btn"} data-tool="note" aria-pressed={tool === "note"} onClick={() => setTool("note")}>▤ ملاحظة</button>
                  <button type="button" className="tool-btn" data-tool="clear" onClick={clearBoard}>↶ مسح الكل</button>
                </div>
                <button type="button" className="tool-btn text-only" id="printBoard" onClick={() => window.print()}>حفظ الصفحة PDF ↗</button>
              </div>
              <p className="board-helper" id="boardHelper">{tool === "pen" ? "ارسم بالقلم فوق المصحف بإصبعك أو بالماوس؛ الرسم هنا تجريبي فقط." : tool === "note" ? "اضغط على الآية المطلوبة، ثم اكتب تعليقك على اليمين." : "اضغط على أي آية لتظليلها."}</p>
            </div>
            <aside className="class-sidebar">
              <div className="video-tiles">
                <div className="video-tile"><div className="avatar">م</div><small>الشيخ · نموذج</small></div>
                <div className="video-tile student"><div className="avatar">أ</div><small>الطالب · نموذج</small></div>
              </div>
              <div className="class-notes"><h4>ملاحظات الحصة</h4><p>حدد أي آية ثم أضف تعليقًا بسيطًا بجانب المصحف.</p><div id="lessonNotes" aria-live="polite">{notes.map((entry) => <div className="note-entry" key={entry.id}><b>{entry.author}</b><span>{entry.text}</span></div>)}</div></div>
              <div className="notes-add"><label htmlFor="lessonNoteText">أضف ملاحظة تجريبية</label><textarea ref={noteRef} id="lessonNoteText" maxLength={150} value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="مثال: أراجع آخر آيتين قبل الحصة القادمة..."></textarea><div className="note-add-row"><select id="noteAuthor" aria-label="كاتب الملاحظة" value={author} onChange={(event) => setAuthor(event.target.value)}><option>الطالب</option><option>الشيخ</option></select><button type="button" className="tool-btn active" id="addNote" onClick={addNote}>إضافة +</button></div></div>
            </aside>
          </div>
        </div>
        <div className="after-class-bar"><div className="after-feature"><strong>يكتب الاثنان</strong><p>قلم وتظليل وملاحظات للشيخ وللطالب، مع تمييز صاحب التعليق.</p></div><div className="after-feature"><strong>لا يضيع ما تعلّمتَه</strong><p>تظل العلامات في ملف الحصة، ويمكنك الرجوع لها عند المراجعة.</p></div><div className="after-feature"><strong>صفحة محفوظة</strong><p>حفظ الصورة أو PDF في ملف الطالب بعد الحصة، إلى جانب تقرير الشيخ.</p></div></div>
        <p className="demo-note"><strong>تنبيه:</strong> المصحف أعلاه مثال نصّي للتصميم فقط، لا يُستخدم كمصدر قرآني رسمي. عند التنفيذ نربطه بمصدر مصحف موثوق، ولا تُحفظ أي ملاحظات على خادم في هذه النسخة.</p>
      </div>
    
  </section>);
}
