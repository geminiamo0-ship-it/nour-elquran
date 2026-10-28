'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useLandingDemo } from './LandingDemoProvider';

type Tab = 'home' | 'classes' | 'quran' | 'training' | 'progress';
const tabs: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'home', label: 'الرئيسية' }, { id: 'classes', label: 'حصصي' },
  { id: 'quran', label: 'المصحف' }, { id: 'training', label: 'تدريباتي' },
  { id: 'progress', label: 'تقدمي' },
];
const slots = [
  'الأحد · ٥:٠٠ مساءً', 'الثلاثاء · ٦:٣٠ مساءً', 'الخميس · ٤:٣٠ مساءً',
] as const;

/** No backend bookings: every appointment and learner here is transient demo state. */
export function DashboardModal() {
  const { session, close } = useLandingDemo();
  const [selectedLearner, setSelectedLearner] = useState('');
  const [tab, setTab] = useState<Tab>('home');
  const [bookings, setBookings] = useState<Record<string, string>>({});
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const active = session?.learners.includes(selectedLearner) ? selectedLearner : session?.learners[0] ?? '';
  const booked = bookings[active];

  useEffect(() => {
    if (!session) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [session]);

  function dismiss() {
    setSelectedLearner('');
    setTab('home');
    setBookings({});
    close();
  }

  function trapKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.stopPropagation(); dismiss(); return; }
    if (event.key !== 'Tab' || !dialog.current) return;
    const elements = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled])')];
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  if (!session) return null;
  return (
    <div className="mock-dashboard-modal open" id="dashboardModal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) dismiss(); }}>
      <div className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modalTitle" ref={dialog} onKeyDown={trapKeyboard}>
        <div className="modal-head">
          <div><span className="eyebrow">تَجْرِبَةُ الطَّالِب</span><h2 id="modalTitle">لوحة {active}</h2></div>
          <button type="button" className="modal-close" ref={closeButton} onClick={dismiss} aria-label="إغلاق النافذة">×</button>
        </div>
        <p className="modal-welcome">مرحبًا {session.accountName}! أنشأنا لك لوحة تجريبية محلية. يمكنك التبديل بين الطلاب واستكشاف الصفحات قبل الحجز.</p>
        <div className="profiles" aria-label="اختر ملف الطالب">
          {session.learners.map((learner) => (
            <button key={learner} type="button" className={learner === active ? 'profile-btn active' : 'profile-btn'} aria-pressed={learner === active} onClick={() => { setSelectedLearner(learner); setTab('home'); }}>{learner}</button>
          ))}
        </div>
        <div className="modal-tabs" role="tablist" aria-label="أقسام لوحة الطالب">
          {tabs.map((item) => (
            <button key={item.id} type="button" role="tab" id={`tab-${item.id}`} aria-controls={`panel-${item.id}`} aria-selected={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>
          ))}
        </div>
        <div className="modal-panels">
          <div data-panel="home" id="panel-home" role="tabpanel" aria-labelledby="tab-home" className={tab === 'home' ? 'active' : ''} hidden={tab !== 'home'}>
            <div className="modal-card"><h3>حفظك يبدأ اليوم</h3><p>لوحتك جاهزة بالفعل. شاهد المصحف واستكشف التدريب، ثم احجز حصتك التجريبية عندما تكون مستعدًا.</p><button className="btn btn-gold" type="button" onClick={() => setTab('classes')}>احجز حصتك التجريبية</button></div>
          </div>
          <div data-panel="classes" id="panel-classes" role="tabpanel" aria-labelledby="tab-classes" className={tab === 'classes' ? 'active' : ''} hidden={tab !== 'classes'}>
            <div className="modal-card"><h3>حصصي القادمة</h3><p>{booked ? `لديك حصة تجريبية توضيحية في ${booked}` : 'ليس لديك موعد بعد. اختر موعدًا تجريبيًا داخل هذه المعاينة.'}</p>
              <div className="mock-slots">{slots.map((slot) => <button type="button" key={slot} className={booked === slot ? 'selected' : ''} aria-pressed={booked === slot} onClick={() => setBookings((current) => ({ ...current, [active]: slot }))}>{slot.replace('مساءً', 'م')}</button>)}</div>
              <div className="status-msg" aria-live="polite">{booked ? `موعد محفوظ للعرض فقط: ${booked}` : 'اختر موعدًا تجريبيًا — كل المواعيد افتراضية.'}</div>
            </div>
          </div>
          <div data-panel="quran" id="panel-quran" role="tabpanel" aria-labelledby="tab-quran" className={tab === 'quran' ? 'active' : ''} hidden={tab !== 'quran'}>
            <div className="modal-card"><h3>مصحفك</h3><p>من هنا يقرأ الطالب أو يستمع للمصحف. في التنفيذ الحقيقي نربطه بنص قرآني وتلاوات موثوقة. ويمكنك تجربة السبورة أعلاه من صفحة الهبوط.</p><a className="btn btn-outline" href="#interactive-classroom" onClick={dismiss}>شاهد نموذج المصحف التفاعلي</a></div>
          </div>
          <div data-panel="training" id="panel-training" role="tabpanel" aria-labelledby="tab-training" className={tab === 'training' ? 'active' : ''} hidden={tab !== 'training'}>
            <div className="modal-card"><h3>تدريباتي</h3><p>قبل تقييم الشيخ يمكنك تجربة واجهة التدريب. بعد الحصة يظهر الورد الذي اعتمده الشيخ، والتكرار والمراجعة المناسبة لك.</p><div className="note-entry"><b>مثال</b><span>استمع إلى سورة الإخلاص وكرر تلاوتها مرتين.</span></div></div>
          </div>
          <div data-panel="progress" id="panel-progress" role="tabpanel" aria-labelledby="tab-progress" className={tab === 'progress' ? 'active' : ''} hidden={tab !== 'progress'}>
            <div className="modal-card"><h3>تقدمي</h3><p>لم تبدأ حصصك بعد، ولذلك لا نظهر إنجازات وهمية. بعد أول حصة سيظهر تقييم المعلم وتقرير الحفظ.</p></div>
          </div>
        </div>
        <p className="form-note" style={{ paddingTop: 12, borderTop: '1px solid #e6dac6' }}>هذه معاينة UI تعمل في المتصفح فقط؛ لا تنشئ حسابًا أو حجزًا أو ملف طالب فعليًا.</p>
      </div>
    </div>
  );
}
