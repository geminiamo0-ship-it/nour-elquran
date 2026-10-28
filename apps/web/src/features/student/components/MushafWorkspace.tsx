'use client';
import { useState } from 'react';
import { useStudent } from '../StudentContext';
import styles from '../StudentPortal.module.css';

// Approved V3 classroom fixture only. Do not use this sample as an authoritative Quran provider.
const sampleAyat = [
  'قُلْ هُوَ اللَّهُ أَحَدٌ ۝١',
  'اللَّهُ الصَّمَدُ ۝٢',
  'لَمْ يَلِدْ وَلَمْ يُولَدْ ۝٣',
  'وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ ۝٤',
] as const;
export function MushafWorkspace() {
  const { selectedAyat, toggleAyah } = useStudent();
  const [fontSize, setFontSize] = useState(30);
  const [selected, setSelected] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [editing, setEditing] = useState('');
  function select(index: number) {
    setSelected(index);
    setEditing(notes[index] ?? '');
  }
  function save() {
    if (selected === null) return;
    setNotes((old) => ({ ...old, [selected]: editing.trim().slice(0, 250) }));
  }
  function reset() {
    selectedAyat.forEach(toggleAyah);
    setSelected(null); setEditing(''); setNotes({});
  }
  return <div className={styles.workspace}>
    <section className={styles.panel}>
      <div className={styles.panelHead}><div><p className={styles.eyebrow}>صفحة تعليمية تفاعلية</p><h2>معاينة المصحف</h2></div>
        <span className={styles.statusNeutral}>نص توضيحي من V3</span></div>
      <p className={styles.panelIntro}>تقدر تظلل الآيات وتضيف ملاحظة لكل آية. هذه معاينة محلية لنص سورة الإخلاص المستخدم في التصميم المعتمد، وليست مصحفًا رسميًا أو مصدرًا مرخّصًا للتلاوة.</p>
      <div className={styles.mushafTools}>
        <label htmlFor="mushaf-font">حجم الخط: {fontSize}px</label>
        <input id="mushaf-font" type="range" min={22} max={44} step={2} value={fontSize}
          onChange={(event) => setFontSize(Number(event.target.value))} />
        <button type="button" onClick={reset} className={styles.filterButton}>مسح العلامات</button>
      </div>
      <div className={styles.mushafPaper} dir="rtl" aria-label="نص قرآني توضيحي من معاينة التصميم">
        <p className={styles.mushafHeading}>سُورَةُ الْإِخْلَاصِ</p>
        <p className={styles.basmala}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
        <div className={styles.ayahList} style={{ fontSize }}>
          {sampleAyat.map((ayah, index) => <button key={ayah} type="button"
            className={selectedAyat.includes(index) ? styles.ayahMarked : styles.ayahButton}
            aria-pressed={selectedAyat.includes(index)}
            onClick={() => { toggleAyah(index); select(index); }}>{ayah}</button>)}
        </div>
      </div>
      <p className={styles.panelFoot}>العلامات مؤقتة ولا تؤثر في النص الأصلي، ولا تُحفظ في تقرير رسمي أو على خادم.</p>
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHead}><div><p className={styles.eyebrow}>ملاحظاتك على الآيات</p><h2>ملاحظة شخصية</h2></div></div>
      {selected === null ? <div className={styles.emptyBox}>اضغط على آية في المصحف أعلاه لتحديدها وكتابة ملاحظة.</div> :
        <div className={styles.formCard}>
          <strong>{sampleAyat[selected]}</strong>
          <label htmlFor="mushaf-note" className={styles.formLabel}>نص الملاحظة (لا يزيد على 250 حرفًا)</label>
          <textarea id="mushaf-note" className={styles.textArea} maxLength={250} rows={3}
            value={editing} onChange={(event) => setEditing(event.target.value)} />
          <div className={styles.actionRow}><span className={styles.muted}>ملاحظة محلية لهذه المعاينة</span>
            <button type="button" className={styles.actionButton} onClick={save}>حفظ الملاحظة</button></div>
        </div>}
      <div className={styles.stack}>{Object.entries(notes).filter(([, text]) => text).map(([index, text]) =>
        <div key={index} className={styles.personalNote}><strong>الآية {Number(index) + 1}</strong><p>{text}</p></div>)}</div>
    </section>
    <div className={styles.infoNote}>تفعيل المصحف الكامل والتلاوات والأرشيف يحتاج مصدرًا قرآنيًا موثّقًا وحقوق استخدام واضحة، ثم ربط الملاحظات بالحصة/الطالب عبر صلاحيات موثّقة.</div>
  </div>;
}
