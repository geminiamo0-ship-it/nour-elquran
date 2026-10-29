'use client';
import Link from 'next/link';
import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import type {ClassroomPreviewModel} from './useClassroomPreview';
import {allowStart,allowEnd} from './domain';
import css from './ClassroomSessionHeader.module.css';

interface Props {
  model:ClassroomPreviewModel;
  focusMode:boolean;
  onToggleFocus:()=>void;
  panelOpen:boolean;
  onTogglePanel:()=>void;
}

function closeMenuOnEscape(event:KeyboardEvent<HTMLDetailsElement>){
  if(event.key!=='Escape')return;
  event.preventDefault();
  event.currentTarget.open=false;
  event.currentTarget.querySelector('summary')?.focus();
}

/** Single session bar. All simulation controls stay behind labeled disclosure menus. */
export function ClassroomSessionHeader({model,focusMode,onToggleFocus,panelOpen,onTogglePanel}:Props){
  const {role,setRole,room,updatePresence,start,end,elapsed,setElapsed,alerts,
    setInkMode,setDrawingAllowed,setMicAllowed,studentMicOn,setStudentMicrophone,
    teacherMic,setTeacherMicrophone}=model;
  const [confirmEnd,setConfirmEnd]=useState(false);
  const confirmRef=useRef<HTMLButtonElement>(null);
  const endTriggerRef=useRef<HTMLButtonElement>(null);
  const canBegin=allowStart(room,role);
  const canClose=allowEnd(room,role);
  useEffect(()=>{if(confirmEnd)confirmRef.current?.focus();},[confirmEnd]);
  useEffect(()=>{if(!canClose)setConfirmEnd(false);},[canClose]);

  return <header className={css.header} aria-label="شريط إدارة الحصة التجريبية">
    <div className={css.identity}>
      <Link href="/teacher" className={css.back} aria-label="العودة إلى بوابة الشيخ">‹</Link>
      <h1>الفصل التفاعلي</h1>
      <span className={css.previewLabel} title="معاينة محلية بلا اتصال أو بيانات طلاب">تجريبي</span>
    </div>
    <div className={css.sessionInfo}>
      <span className={css.phase} data-phase={room.phase}>
        {room.phase==='waiting'?'انتظار':room.phase==='live'?'مباشر تجريبي':'منتهية'}
      </span>
      <span className={css.clock} aria-label={'الوقت التجريبي '+elapsed+' دقيقة'}>◷ {elapsed}:00</span>
      {alerts.instructionEnded&&<span className={css.alert}>٣٠د</span>}
      {alerts.reservedSlotEnded&&<span className={css.alert}>٤٠د</span>}
      {alerts.nextConflict&&<span className={css.alert}>تعارض</span>}
    </div>
    <div className={css.actions}>
      {room.phase==='waiting'&&role==='teacher'&&
        <button type="button" className={css.start} disabled={!canBegin} onClick={start}
          title={canBegin?'بدء المحاكاة بعد حضور الطرفين':'يتطلب حضور الشيخ والطالب'}>بدء الحصة</button>}
      {room.phase==='live'&&role==='teacher'&&
        <button ref={endTriggerRef} type="button" className={css.end}
          onClick={()=>setConfirmEnd(true)}>إنهاء الحصة</button>}
      {confirmEnd&&canClose&&<div className={css.confirm} role="group" aria-label="تأكيد الإنهاء اليدوي"
        onKeyDown={event=>{if(event.key==='Escape'){setConfirmEnd(false);endTriggerRef.current?.focus();}}}>
        <strong>إنهاء الحصة التجريبية؟</strong>
        <button ref={confirmRef} type="button" className={css.end}
          onClick={()=>{end();setConfirmEnd(false);}}>تأكيد الإنهاء</button>
        <button type="button" onClick={()=>{setConfirmEnd(false);endTriggerRef.current?.focus();}}>إلغاء</button>
      </div>}
      {role==='teacher'&&<button type="button" className={css.iconAction} aria-label="الأخطاء والتقييم"
        aria-expanded={panelOpen} aria-controls="lesson-notes" onClick={onTogglePanel}
        title="الأخطاء والتقييم">✎</button>}
      <button type="button" className={css.iconAction} aria-label={focusMode?'الخروج من وضع الحصة':'وضع الحصة'}
        aria-pressed={focusMode} title={focusMode?'الخروج من وضع الحصة':'وضع الحصة'}
        onClick={onToggleFocus}>⛶</button>
      {room.phase==='live'&&<details className={css.menu} onKeyDown={closeMenuOnEscape}>
        <summary aria-label="أدوات الصوت والرسم" title="أدوات الصوت والرسم">♫</summary>
        <div className={css.menuPanel}>
          <strong>الصوت والرسم · محاكاة فقط</strong>
          {role==='teacher'?<>
            <button type="button" onClick={()=>setTeacherMicrophone(!teacherMic)}>
              {teacherMic?'كتم مايك الشيخ':'تشغيل مايك الشيخ'}</button>
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
        </div>
      </details>}
      <details className={css.menu} onKeyDown={closeMenuOnEscape}>
        <summary aria-label="إعدادات المعاينة" title="إعدادات المعاينة">⚙</summary>
        <div className={css.menuPanel}>
          <strong>إعدادات المعاينة · لا توجد غرفة حقيقية</strong>
          <label>تبديل منظور المعاينة
            <select aria-label="تبديل منظور المعاينة" value={role}
              onChange={event=>{setRole(event.target.value as 'teacher'|'student');setInkMode('off');}}>
              <option value="teacher">واجهة الشيخ</option><option value="student">واجهة الطالب</option>
            </select>
          </label>
          <div className={css.presence}>
            <span>حضور تجريبي (ليس إثبات هوية)</span>
            <label><input type="checkbox" checked={room.teacherPresent}
              onChange={event=>updatePresence('teacher',event.target.checked)}/> الشيخ موجود</label>
            <label><input type="checkbox" checked={room.learnerPresent}
              onChange={event=>updatePresence('student',event.target.checked)}/> الطالب موجود</label>
          </div>
          <label>ضبط الوقت التجريبي: {elapsed} دقيقة
            <input type="range" min="0" max="60" step="1" value={elapsed}
              onChange={event=>setElapsed(Number(event.target.value))}/>
          </label>
          <div className={css.previewLinks}>
            <Link href="/classroom?view=teacher" onClick={()=>{setRole('teacher');setInkMode('off');}}>رابط معاينة الشيخ</Link>
            <Link href="/classroom?view=student" onClick={()=>{setRole('student');setInkMode('off');}}>رابط معاينة الطالب</Link>
          </div>
          <small>٣٠ دقيقة تعليم · ٤٠ دقيقة حجز · الإنهاء بيد الشيخ فقط. لا اتصال أو حفظ على الخادم.</small>
        </div>
      </details>
    </div>
  </header>;
}
