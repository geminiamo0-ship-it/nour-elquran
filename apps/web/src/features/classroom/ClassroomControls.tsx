'use client';
import {useState} from 'react';
import type {ClassroomPreviewModel} from './useClassroomPreview';
import {allowStart,allowEnd} from './domain';
import css from './Classroom.module.css';

const tools=[{id:'off',label:'تحديد الآية',icon:'⌖'},{id:'pen',label:'قلم',icon:'✎'},
  {id:'marker',label:'تظليل',icon:'▰'},{id:'eraser',label:'ممحاة',icon:'⌫'}] as const;
const colors=['#d0a94c','#388e68','#e2604e','#397ca7','#8d67b0'] as const;
export function ClassroomControls({model}:{model:ClassroomPreviewModel}){
  const {role,setRole,room,updatePresence,start,end,elapsed,setElapsed,alerts,
    inkMode,setInkMode,inkColor,setInkColor,drawingAvailable,setPage,
    setDrawingAllowed,setMicAllowed,studentMicOn,setStudentMicrophone,
    teacherMic,setTeacherMicrophone}=model;
  const [confirmEnd,setConfirmEnd]=useState(false);
  const canBegin=allowStart(room,role);
  const canClose=allowEnd(room,role);
  return <>
    <div className={css.topline}>
      <div className={css.lessonTitle}>
        <h1>الفصل التفاعلي</h1>
        <span className={css.demoTag} title="هذه بيانات تجريبية ولا يوجد اتصال LiveKit أو حفظ على الخادم">معاينة الفصل التفاعلي فقط</span>
      </div>
      <div className={css.topControls}>
        <label className={css.roleSwitch}>عرض المعاينة
          <select aria-label="تبديل منظور المعاينة" value={role} onChange={e=>{setRole(e.target.value as 'teacher'|'student');setInkMode('off');}}>
            <option value="teacher">واجهة الشيخ</option><option value="student">واجهة الطالب</option>
          </select>
        </label>
        <span className={room.phase==='live'?css.stateLive:room.phase==='ended'?css.stateEnded:css.stateWaiting}>
          {room.phase==='waiting'?'غرفة الانتظار':room.phase==='live'?'حصة تجريبية جارية':'أُنهِيَت يدويًا'}
        </span>
      </div>
    </div>
    <div className={css.prejoinCard}>
      <div className={css.prejoinPeople}>
        <strong className={css.presenceHeading}>حضور الطرفين في غرفة الانتظار</strong>
        <label><input type="checkbox" checked={room.teacherPresent}
          onChange={e=>updatePresence('teacher',e.target.checked)}/> الشيخ موجود</label>
        <label><input type="checkbox" checked={room.learnerPresent}
          onChange={e=>updatePresence('student',e.target.checked)}/> الطالب موجود</label>
      </div>
      <div className={css.compactClock}>
        <details className={css.clockDetails}>
          <summary aria-label="ضبط الوقت التجريبي">◷ {elapsed}:00 <span className={css.clockLabel}>دقيقة تجريبية</span></summary>
          <div className={css.clockDropdown}>
            <label>اختبار الوقت: {elapsed} دقيقة
              <input type="range" min="0" max="60" step="1" value={elapsed}
                onChange={e=>setElapsed(Number(e.target.value))}/>
            </label>
            <small>٣٠ دقيقة تعليم · ٤٠ دقيقة حجز، دون إنهاء تلقائي</small>
          </div>
        </details>
        {alerts.instructionEnded&&<span className={css.warningChip}>انتهاء وقت التعليم</span>}
        {alerts.reservedSlotEnded&&<span className={css.warningChip}>انتهاء الحجز</span>}
        {alerts.nextConflict&&<span className={css.dangerChip}>تعارض موعد</span>}
      </div>
      <div className={css.prejoinActions}>
        {room.phase==='waiting'&&<><button className={css.primaryBtn} type="button" disabled={!canBegin}
          onClick={start}>محاكاة «بدء الحصة»</button>
          <span>{role==='student'?'الطالب لا يستطيع بدء الحصة':canBegin?'الطرفان موجودان · الشيخ يضغط البدء':'يجب وجود الشيخ والطالب أولًا'}</span></>}
        {room.phase==='live'&&<><button className={css.endBtn} type="button" disabled={!canClose}
          onClick={()=>setConfirmEnd(true)}>إنهاء الفصل بيد الشيخ</button>
          <span>{role==='student'?'الطالب لا يمتلك إنهاء الفصل':'لا يوجد إغلاق تلقائي عند ٣٠ أو ٤٠ دقيقة'}</span></>}
        {room.phase==='ended'&&<span className={css.successNote}>الفصل أُغلق في المعاينة بقرار الشيخ فقط؛ التقرير يظل مسودة.</span>}
        {confirmEnd&&canClose&&<div className={css.confirmInline} role="group" aria-label="تأكيد إنهاء الحصة">
          <strong>تأكيد الإنهاء اليدوي؟</strong>
          <button type="button" className={css.endBtn} onClick={()=>{end();setConfirmEnd(false);}}>تأكيد إنهاء الفصل</button>
          <button type="button" onClick={()=>setConfirmEnd(false)}>إلغاء</button>
        </div>}
      </div>
    </div>

    <div className={css.toolbar} role="toolbar" aria-label="أدوات المصحف المشترك">
      <div className={css.toolGroup}>
        {tools.map(t=><button key={t.id} type="button" title={t.label}
          aria-pressed={inkMode===t.id} disabled={room.phase!=='live'||(t.id!=='off'&&!drawingAvailable)}
          onClick={()=>setInkMode(t.id)}><span aria-hidden="true">{t.icon}</span>{t.label}</button>)}
      </div>
      <div className={css.colors} aria-label="ألوان القلم">{colors.map(c=><button key={c} type="button" title={'لون '+c}
        className={inkColor===c?css.selectedColor:css.color} style={{background:c}}
        aria-label={'اختر لون '+c} aria-pressed={inkColor===c} disabled={room.phase!=='live'||!drawingAvailable}
        onClick={()=>setInkColor(c)}/>)}</div>
      <div className={css.toolGroup}>
        <button type="button" disabled={role!=='teacher'||room.phase!=='live'||room.currentPage<=1}
          onClick={()=>setPage(room.currentPage-1)}>صفحة سابقة ↑</button>
        <span>صفحة {room.currentPage} / 604</span>
        <button type="button" disabled={role!=='teacher'||room.phase!=='live'||room.currentPage>=604}
          onClick={()=>setPage(room.currentPage+1)}>صفحة تالية ↓</button>
      </div>
    </div>
    {room.phase==='live'&&<div className={css.mediaControls}>
      {role==='teacher'?<>
        <button type="button" onClick={()=>setTeacherMicrophone(!teacherMic)}>
          {teacherMic?'كتم مايك الشيخ (محاكاة)':'تشغيل مايك الشيخ (محاكاة)'}</button>
        <button type="button" onClick={()=>setMicAllowed(!room.studentMicAllowed)}>
          {room.studentMicAllowed?'كتم الطالب ومنع فتح المايك':'السماح للطالب بتشغيل المايك بنفسه'}</button>
        <button type="button" onClick={()=>setDrawingAllowed(!room.studentDrawingAllowed)}>
          {room.studentDrawingAllowed?'إيقاف رسم الطالب المشترك':'السماح برسم الطالب'}</button>
      </>:<>
        <button type="button" disabled={!room.studentMicAllowed&&!studentMicOn}
          onClick={()=>setStudentMicrophone(!studentMicOn)}>
          {studentMicOn?'إغلاق مايك الطالب':room.studentMicAllowed?'فتح مايك الطالب بنفسي':'كتم الشيخ مايك الطالب'}</button>
        {!room.studentDrawingAllowed&&<span>الرسم المشترك متوقف بأمر الشيخ</span>}
      </>}
    </div>}
  </>;
}
