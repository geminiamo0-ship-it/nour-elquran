'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useStudent } from '../StudentContext';
import styles from '../StudentPortal.module.css';

function cairoToday(): Date {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1));
}
function dateAt(today: Date, offset: number): Date {
  const copy = new Date(today);
  copy.setUTCDate(copy.getUTCDate() + offset);
  return copy;
}
const weekday = new Intl.DateTimeFormat('ar-EG', { weekday: 'short', timeZone: 'UTC' });
const dayLabel = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export function SchedulePanel({ detailed = false }: { detailed?: boolean }) {
  const { selected } = useStudent();
  const [today, setToday] = useState<Date | null>(null);
  const [week, setWeek] = useState(0);
  const [selectedOffset, setSelectedOffset] = useState(0);
  useEffect(() => setToday(cairoToday()), []);
  const dayLessons = selected.lessons.filter((lesson) => lesson.dayOffset === selectedOffset);
  const dayOffsets = Array.from({ length: 7 }, (_, i) => week * 7 + i);
  function navigateWeek(direction: number) {
    const next = week + direction;
    if (next < -4 || next > 12) return;
    setWeek(next);
    setSelectedOffset(next * 7);
  }
  return <section className={styles.panel} aria-labelledby="schedule-panel-heading">
    <div className={styles.panelHead}>
      <div><span className={styles.eyebrow}>تنظيم الأسبوع</span><h2 id="schedule-panel-heading">الحصص والجدول</h2></div>
      {!detailed && <Link href="/student/lessons" className={styles.inlineLink}>الجدول الكامل ‹</Link>}
    </div>
    <div className={styles.weekControls}>
      <button type="button" onClick={() => navigateWeek(-1)} disabled={week <= -4} aria-label="الأسبوع السابق">❯</button>
      <span>{today ? fullDate.format(dateAt(today, week * 7)) : 'تحميل أيام الأسبوع…'}</span>
      <button type="button" onClick={() => navigateWeek(1)} disabled={week >= 12} aria-label="الأسبوع التالي">❮</button>
    </div>
    <div className={styles.daysStrip} aria-label="اختر يومًا من الأسبوع">
      {dayOffsets.map((offset) => <button key={offset} type="button"
        className={offset === selectedOffset ? styles.daySelected : styles.dayButton}
        aria-pressed={offset === selectedOffset}
        onClick={() => setSelectedOffset(offset)}>
        <span>{today ? weekday.format(dateAt(today, offset)) : '—'}</span>
        <strong>{today ? dayLabel.format(dateAt(today, offset)) : '·'}</strong>
        <i className={selected.lessons.some((lesson) => lesson.dayOffset === offset) ? styles.dayDot : styles.noDot} aria-hidden="true" />
      </button>)}
    </div>
    <div className={styles.selectedDate}>{today ? fullDate.format(dateAt(today, selectedOffset)) : 'اليوم المحدد'}</div>
    {dayLessons.length ? <div className={styles.lessonList}>
      {dayLessons.map((lesson) => <article key={lesson.id} className={styles.lessonRow}>
        <div className={styles.lessonTime}><strong>{lesson.time}</strong><span>{lesson.durationMinutes} دقيقة</span></div>
        <div className={styles.lessonInfo}><strong>{lesson.topic}</strong><span>{lesson.teacher} · {lesson.kind === 'trial' ? 'تجريبية' : 'مراجعة وحفظ'}</span></div>
        <span className={lesson.status === 'completed' ? styles.statusNeutral : styles.statusSoft}>{lesson.status === 'completed' ? 'مكتملة · مثال' : lesson.status === 'cancelled' ? 'ملغاة · مثال' : 'موعد توضيحي'}</span>
      </article>)}
    </div> : <div className={styles.emptyBox}>
      <p>{selected.profile.stage === 'new' ? 'لا توجد حصص في ملفك بعد. تجربة الحجز ستكون من لوحة الطالب بعد تفعيل النظام.' : 'لا توجد حصص في هذا اليوم.'}</p>
      {selected.profile.stage === 'new' && <span className={styles.muted}>لن نعرض أي موعد وهمي على أنه حجز مؤكد.</span>}
    </div>}
    <div className={styles.panelFoot}>جميع المواعيد الظاهرة هنا بيانات توضيحية لا يمكن الانضمام إليها.</div>
  </section>;
}
