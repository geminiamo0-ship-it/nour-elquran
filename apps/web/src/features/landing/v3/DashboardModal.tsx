'use client';
import { useEffect, useRef } from 'react';
import { useLandingDemo } from './LandingDemoProvider';

export function DashboardModal() {
  const { open, accountName, students, activeStudent, tab, bookings,
    closeDashboard, selectStudent, selectTab, selectSlot } = useLandingDemo();
  const booking = bookings[activeStudent];
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDashboard(); };
    document.addEventListener('keydown', onEscape);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', onEscape); };
  }, [open, closeDashboard]);
  return (<div className={open ? "mock-dashboard-modal open" : "mock-dashboard-modal"} id="dashboardModal"
    role="dialog" aria-modal={open} aria-labelledby="modalTitle" aria-hidden={!open}
    onMouseDown={(event) => { if (event.target === event.currentTarget) closeDashboard(); }}>

    <div className="modal-dialog"><div className="modal-head"><div><span className="eyebrow">تَجْرِبَةُ الطَّالِب</span><h2 id="modalTitle">{activeStudent ? `لوحة ${activeStudent}` : "لوحة الطالب"}</h2></div><button type="button" className="modal-close" id="closeModal" aria-label="إغلاق النافذة" ref={closeRef} onClick={closeDashboard}>×</button></div><p className="modal-welcome" id="modalWelcome">{`مرحبًا ${accountName}! أنشأنا لك لوحة تجريبية محلية. يمكنك التبديل بين الطلاب واستكشاف الصفحات قبل الحجز.`}</p>
      <div className="profiles" id="createdProfiles">{students.map((student) => <button type="button" key={student} className={student === activeStudent ? "profile-btn active" : "profile-btn"} onClick={() => selectStudent(student)}>{student}</button>)}</div><div className="modal-tabs" id="modalTabs"><button type="button" className={tab === "home" ? "active" : ""} data-tab="home" onClick={() => selectTab("home")}>الرئيسية</button><button type="button" className={tab === "classes" ? "active" : ""} data-tab="classes" onClick={() => selectTab("classes")}>حصصي</button><button type="button" className={tab === "quran" ? "active" : ""} data-tab="quran" onClick={() => selectTab("quran")}>المصحف</button><button type="button" className={tab === "training" ? "active" : ""} data-tab="training" onClick={() => selectTab("training")}>تدريباتي</button><button type="button" className={tab === "progress" ? "active" : ""} data-tab="progress" onClick={() => selectTab("progress")}>تقدمي</button></div>
      <div className="modal-panels"><div className={tab === "home" ? "active" : ""} data-panel="home"><div className="modal-card"><h3>حفظك يبدأ اليوم 🌿</h3><p>لوحتك جاهزة بالفعل. شاهد المصحف واستكشف التدريب، ثم احجز حصتك التجريبية عندما تكون مستعدًا.</p><button className="btn btn-gold" id="homeBookBtn" type="button" onClick={() => selectTab("classes")}>احجز حصتك التجريبية</button></div></div>
      <div className={tab === "classes" ? "active" : ""} data-panel="classes"><div className="modal-card"><h3>حصصي القادمة</h3><p id="classesText">{booking ? `لديك حصة تجريبية توضيحية في ${booking}` : "ليس لديك موعد بعد. اختر موعدًا تجريبيًا داخل هذه المعاينة."}</p><div className="mock-slots" id="mockSlots"><button type="button" data-slot="الأحد · ٥:٠٠ مساءً" className={booking === "الأحد · ٥:٠٠ مساءً" ? "selected" : ""} onClick={() => selectSlot("الأحد · ٥:٠٠ مساءً")}>الأحد · ٥:٠٠ م</button><button type="button" data-slot="الثلاثاء · ٦:٣٠ مساءً" className={booking === "الثلاثاء · ٦:٣٠ مساءً" ? "selected" : ""} onClick={() => selectSlot("الثلاثاء · ٦:٣٠ مساءً")}>الثلاثاء · ٦:٣٠ م</button><button type="button" data-slot="الخميس · ٤:٣٠ مساءً" className={booking === "الخميس · ٤:٣٠ مساءً" ? "selected" : ""} onClick={() => selectSlot("الخميس · ٤:٣٠ مساءً")}>الخميس · ٤:٣٠ م</button></div><div className="status-msg" id="bookingStatus">{booking ? `موعد محفوظ للعرض فقط: ${booking}` : "اختر موعدًا تجريبيًا — كل المواعيد افتراضية."}</div></div></div>
      <div className={tab === "quran" ? "active" : ""} data-panel="quran"><div className="modal-card"><h3>مصحفك</h3><p>من هنا يقرأ الطالب أو يستمع للمصحف. في التنفيذ الحقيقي نربطه بنص قرآني وتلاوات موثوقة. ويمكنك تجربة السبورة أعلاه من صفحة الهبوط.</p><a className="btn btn-outline" href="#interactive-classroom" id="openClassDemoFromModal" onClick={closeDashboard}>شاهد نموذج المصحف التفاعلي</a></div></div>
      <div className={tab === "training" ? "active" : ""} data-panel="training"><div className="modal-card"><h3>تدريباتي</h3><p>قبل تقييم الشيخ يمكنك تجربة واجهة التدريب. بعد الحصة يظهر الورد الذي اعتمده الشيخ، والتكرار والمراجعة المناسبة لك.</p><div className="note-entry"><b>مثال</b><span>استمع إلى سورة الإخلاص وكرر تلاوتها مرتين.</span></div></div></div>
      <div className={tab === "progress" ? "active" : ""} data-panel="progress"><div className="modal-card"><h3>تقدمي</h3><p>لم تبدأ حصصك بعد، ولذلك لا نظهر إنجازات وهمية. بعد أول حصة سيظهر تقييم المعلم وتقرير الحفظ.</p></div></div></div>
      <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}><a className="btn btn-gold" href="/student" onClick={closeDashboard}>افتح لوحة الطالب الكاملة ←</a></div>
      <p className="form-note" style={{"paddingTop":"12px","borderTop":"1px solid #e6dac6"}}>هذه معاينة UI تعمل في المتصفح فقط؛ لا تنشئ حسابًا أو حجزًا أو ملف طالب فعليًا.</p>
    </div>
  
  </div>);
}
