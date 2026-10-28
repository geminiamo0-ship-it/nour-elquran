'use client';
import { useEffect, useRef } from 'react';
import { useLandingDemo } from './LandingDemoProvider';

export function DashboardModal() {
  const { open, accountName, students, activeStudent, tab, bookings,
    closeDashboard, selectStudent, selectTab, selectSlot } = useLandingDemo();
  const booking = bookings[activeStudent];
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeDashboard(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [open, closeDashboard]);
  return (<div className={open ? "mock-dashboard-modal open" : "mock-dashboard-modal"} id="dashboardModal"
    role="dialog" aria-modal={open} aria-labelledby="modalTitle" aria-hidden={!open}
    onMouseDown={(event) => { if (event.target === event.currentTarget) closeDashboard(); }}>

    <div className="modal-dialog" ref={dialogRef}><div className="modal-head"><div><span className="eyebrow">تَجْرِبَةُ الطَّالِب</span><h2 id="modalTitle">{activeStudent ? `لوحة ${activeStudent}` : "لوحة الطالب"}</h2></div><button type="button" className="modal-close" id="closeModal" aria-label="إغلاق النافذة" ref={closeRef} onClick={closeDashboard}>×</button></div><p className="modal-welcome" id="modalWelcome">{`مرحبًا ${accountName}! أنشأنا لك لوحة تجريبية محلية. يمكنك التبديل بين الطلاب واستكشاف الصفحات قبل الحجز.`}</p>
      <div className="profiles" id="createdProfiles" aria-label="ملفات الطلاب">{students.map((student) => <button type="button" key={student} className={student === activeStudent ? "profile-btn active" : "profile-btn"} aria-pressed={student === activeStudent} onClick={() => selectStudent(student)}>{student}</button>)}</div><div className="modal-tabs" id="modalTabs" role="tablist" aria-label="أقسام لوحة الطالب"><button type="button" className={tab === "home" ? "active" : ""} data-tab="home" role="tab" id="tab-home" aria-controls="panel-home" aria-selected={tab === "home"} onClick={() => selectTab("home")}>الرئيسية</button><button type="button" className={tab === "classes" ? "active" : ""} data-tab="classes" role="tab" id="tab-classes" aria-controls="panel-classes" aria-selected={tab === "classes"} onClick={() => selectTab("classes")}>حصصي</button><button type="button" className={tab === "quran" ? "active" : ""} data-tab="quran" role="tab" id="tab-quran" aria-controls="panel-quran" aria-selected={tab === "quran"} onClick={() => selectTab("quran")}>المصحف</button><button type="button" className={tab === "training" ? "active" : ""} data-tab="training" role="tab" id="tab-training" aria-controls="panel-training" aria-selected={tab === "training"} onClick={() => selectTab("training")}>تدريباتي</button><button type="button" className={tab === "progress" ? "active" : ""} data-tab="progress" role="tab" id="tab-progress" aria-controls="panel-progress" aria-selected={tab === "progress"} onClick={() => selectTab("progress")}>تقدمي</button></div>
      <div className="modal-panels"><div className={tab === "home" ? "active" : ""} data-panel="home" id="panel-home" role="tabpanel" aria-labelledby="tab-home" hidden={tab !== "home"}><div className="modal-card"><h3>حفظك يبدأ اليوم 🌿</h3><p>لوحتك جاهزة بالفعل. شاهد المصحف واستكشف التدريب، ثم احجز حصتك التجريبية عندما تكون مستعدًا.</p><button className="btn btn-gold" id="homeBookBtn" type="button" onClick={() => selectTab("classes")}>احجز حصتك التجريبية</button></div></div>
      <div className={tab === "classes" ? "active" : ""} data-panel="classes" id="panel-classes" role="tabpanel" aria-labelledby="tab-classes" hidden={tab !== "classes"}><div className="modal-card"><h3>حصصي القادمة</h3><p id="classesText">{booking ? `لديك حصة تجريبية توضيحية في ${booking}` : "ليس لديك موعد بعد. اختر موعدًا تجريبيًا داخل هذه المعاينة."}</p><div className="mock-slots" id="mockSlots"><button type="button" data-slot="الأحد · ٥:٠٠ مساءً" className={booking === "الأحد · ٥:٠٠ مساءً" ? "selected" : ""} aria-pressed={booking === "الأحد · ٥:٠٠ مساءً"} onClick={() => selectSlot("الأحد · ٥:٠٠ مساءً")}>الأحد · ٥:٠٠ م</button><button type="button" data-slot="الثلاثاء · ٦:٣٠ مساءً" className={booking === "الثلاثاء · ٦:٣٠ مساءً" ? "selected" : ""} aria-pressed={booking === "الثلاثاء · ٦:٣٠ مساءً"} onClick={() => selectSlot("الثلاثاء · ٦:٣٠ مساءً")}>الثلاثاء · ٦:٣٠ م</button><button type="button" data-slot="الخميس · ٤:٣٠ مساءً" className={booking === "الخميس · ٤:٣٠ مساءً" ? "selected" : ""} aria-pressed={booking === "الخميس · ٤:٣٠ مساءً"} onClick={() => selectSlot("الخميس · ٤:٣٠ مساءً")}>الخميس · ٤:٣٠ م</button></div><div className="status-msg" id="bookingStatus" aria-live="polite">{booking ? `موعد محفوظ للعرض فقط: ${booking}` : "اختر موعدًا تجريبيًا — كل المواعيد افتراضية."}</div></div></div>
      <div className={tab === "quran" ? "active" : ""} data-panel="quran" id="panel-quran" role="tabpanel" aria-labelledby="tab-quran" hidden={tab !== "quran"}><div className="modal-card"><h3>مصحفك</h3><p>من هنا يقرأ الطالب أو يستمع للمصحف. في التنفيذ الحقيقي نربطه بنص قرآني وتلاوات موثوقة. ويمكنك تجربة السبورة أعلاه من صفحة الهبوط.</p><a className="btn btn-outline" href="#interactive-classroom" id="openClassDemoFromModal" onClick={closeDashboard}>شاهد نموذج المصحف التفاعلي</a></div></div>
      <div className={tab === "training" ? "active" : ""} data-panel="training" id="panel-training" role="tabpanel" aria-labelledby="tab-training" hidden={tab !== "training"}><div className="modal-card"><h3>تدريباتي</h3><p>قبل تقييم الشيخ يمكنك تجربة واجهة التدريب. بعد الحصة يظهر الورد الذي اعتمده الشيخ، والتكرار والمراجعة المناسبة لك.</p><div className="note-entry"><b>مثال</b><span>استمع إلى سورة الإخلاص وكرر تلاوتها مرتين.</span></div></div></div>
      <div className={tab === "progress" ? "active" : ""} data-panel="progress" id="panel-progress" role="tabpanel" aria-labelledby="tab-progress" hidden={tab !== "progress"}><div className="modal-card"><h3>تقدمي</h3><p>لم تبدأ حصصك بعد، ولذلك لا نظهر إنجازات وهمية. بعد أول حصة سيظهر تقييم المعلم وتقرير الحفظ.</p></div></div></div>
      <p className="form-note" style={{"paddingTop":"12px","borderTop":"1px solid #e6dac6"}}>هذه معاينة UI تعمل في المتصفح فقط؛ لا تنشئ حسابًا أو حجزًا أو ملف طالب فعليًا.</p>
    </div>
  
  </div>);
}
