'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useStudent } from '../StudentContext';
import { SchedulePanel } from './SchedulePanel';
import { ConnectedClassroomLessons } from './ConnectedClassroomLessons';
import { BookingWorkspace } from './BookingWorkspace';
import styles from '../StudentPortal.module.css';

type Filter = 'upcoming' | 'completed' | 'all';
export function LessonHub() {
  const { selected } = useStudent();
  const [filter, setFilter] = useState<Filter>('upcoming');
  const matches = selected.lessons.filter((lesson) => {
    if (filter === 'upcoming') return lesson.status === 'booked' && lesson.dayOffset >= 0;
    if (filter === 'completed') return lesson.status === 'completed';
    return true;
  }).slice().sort((a, b) => a.dayOffset - b.dayOffset || a.time.localeCompare(b.time));
  if(!selected.profile.demo)return <ConnectedClassroomLessons learnerId={selected.profile.id}/>;
  return <div className={styles.workspace}>
    <SchedulePanel detailed />
    <BookingWorkspace />
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <div><p className={styles.eyebrow}>سجل الحصص</p><h2>تفاصيل المواعيد</h2></div>
        <span className={styles.statusNeutral}>بيانات توضيحية</span>
      </div>
      <div className={styles.filterRow} role="group" aria-label="تصفية الحصص">
        {([{ id: 'upcoming', label: 'القادمة' }, { id: 'completed', label: 'السابقة' },
          { id: 'all', label: 'الكل' }] as const).map((item) =>
          <button type="button" key={item.id} aria-pressed={filter === item.id}
            className={filter === item.id ? styles.filterActive : styles.filterButton}
            onClick={() => setFilter(item.id)}>{item.label}</button>)}
      </div>
      {matches.length ? <div className={styles.stack}>
        {matches.map((lesson) => <details key={lesson.id} className={styles.detailItem}>
          <summary><span><strong>{lesson.topic}</strong><small>{lesson.teacher} · {lesson.time} · {lesson.durationMinutes} دقيقة</small></span>
            <span className={styles.statusSoft}>{lesson.status === 'completed' ? 'انتهت' : lesson.status === 'cancelled' ? 'ألغيت' : 'موعد مثال'}</span></summary>
          <div className={styles.detailBody}>
            <p>توقيت الحصة: {lesson.dayOffset === 0 ? 'اليوم' : lesson.dayOffset > 0 ? 'بعد ' + lesson.dayOffset + ' يوم' : 'منذ ' + Math.abs(lesson.dayOffset) + ' يوم'}، الساعة {lesson.time} (بتوقيت مصر).</p>
            <p>نوع اللقاء: {lesson.kind === 'trial' ? 'تجريبي' : 'حفظ ومراجعة'}.</p>
            {lesson.status === 'completed' ?
              <div className={styles.actionRow}><Link href="/student/progress" className={styles.outlineButton}>التقارير المنشورة</Link>
                <Link href="/student/notebook" className={styles.outlineButton}>دفتر الحصة</Link></div> :
              <div className={styles.infoNote}>زر الانضمام أو تغيير الموعد غير مفعل في المعاينة. لا توجد غرفة LiveKit أو حجز مؤكد.</div>}
          </div>
        </details>)}
      </div> : <div className={styles.emptyBox}>لا توجد حصص مطابقة لهذه التصفية. لم ننشئ مواعيد أو سجلات افتراضية للطالب الجديد.</div>}
    </section>
    <div className={styles.infoNote}>الحجز والإلغاء وطلب التعويض والاعتراض على الغياب ستتصل بسجل مواعيد موثّق بعد تفعيل الـBackend. لا يوجد طلب يُرسَل حاليًا.</div>
  </div>;
}
