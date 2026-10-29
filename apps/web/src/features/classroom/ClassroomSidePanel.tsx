'use client';
import {useState} from 'react';
import type {ClassroomPreviewModel} from './useClassroomPreview';
import {ERROR_LABEL,type ErrorKind} from './domain';
import css from './Classroom.module.css';

const categories:readonly ErrorKind[]=['memorization','tajweed','pronunciation','repeat'];
const grades=[{id:'hifz',label:'الحفظ'},{id:'recitation',label:'التلاوة'},{id:'tajweed',label:'التجويد'}] as const;

export function ClassroomSidePanel({model}:{model:ClassroomPreviewModel}){
  const [kind,setKind]=useState<ErrorKind>('memorization');
  const [description,setDescription]=useState('');
  const [tab,setTab]=useState<'corrections'|'notes'|'draft'>('corrections');
  const {role,room,target,errors,notes,scores,records,audit,
    addError,changeNotes,grade,hideStroke}=model;
  if(role==='student')return <aside className={css.notesPanel}>
    <div className={css.panelHeading}><strong>مساحة الطالب</strong></div>
    <p className={css.hint}>تظهر للطالب العلامات المشتركة التي سمح بها الشيخ. ملاحظاته الشخصية لا تنتقل إلى شاشة الشيخ أو التقرير تلقائيًا.</p>
    {room.phase==='live'&&!room.studentDrawingAllowed&&<div className={css.warn}>أوقف الشيخ الرسم المشترك للطالب مؤقتًا. الملاحظات الشخصية تبقى خاصة.</div>}
    <div className={css.panelHeading}><strong>صفحة المصحف</strong></div>
    <p>الصفحة {room.currentPage}، والشيخ يتحكم في التنقل أثناء الحصة.</p>
  </aside>;
  return <aside className={css.notesPanel} aria-label="لوحة تصحيحات الشيخ الخاصة">
    <div className={css.panelHeading}><strong>ملف الحصة</strong><span>خاص بالشيخ</span></div>
    <nav className={css.tabs} role="tablist" aria-label="لوحة الشيخ">
      {([{id:'corrections',label:'الأخطاء'},{id:'notes',label:'الملاحظات'},{id:'draft',label:'التقييم'}] as const).map(item=>
        <button key={item.id} type="button" role="tab" aria-selected={tab===item.id}
          onClick={()=>setTab(item.id)}>{item.label}</button>)}
    </nav>
    {tab==='corrections'&&<div className={css.tabBody}>
      <p className={css.hint}>حدد آية في المصحف ثم اختر نوع التصحيح. تُحفظ الأخطاء بمعرّف السورة والآية ولا يتغير نص القرآن.</p>
      <div className={css.selectedAyah}><span>الآية المحددة</span><strong>{target?`${target.surah} : ${target.ayah}`:'اختر آية أولًا'}</strong></div>
      <label className={css.field}>نوع الخطأ
        <select value={kind} onChange={e=>setKind(e.target.value as ErrorKind)} disabled={room.phase!=='live'}>
          {categories.map(key=><option key={key} value={key}>{ERROR_LABEL[key]}</option>)}
        </select>
      </label>
      <label className={css.field}>ملاحظة قصيرة
        <textarea value={description} maxLength={500} rows={3} disabled={room.phase!=='live'}
          onChange={e=>setDescription(e.target.value)} placeholder="مثال: يكرر الآية لضبط المد"/>
      </label>
      <button type="button" className={css.primaryBtn} disabled={!target||room.phase!=='live'}
        onClick={()=>{if(addError(kind,description))setDescription('');}}>تسجيل تصحيح تجريبي</button>
      <div className={css.panelHeading}><strong>أخطاء الحصة</strong><small>{errors.length}</small></div>
      {errors.length?errors.map(error=><div className={css.errorCard} key={error.id}>
        <b>{ERROR_LABEL[error.kind]} · {error.target.surah}:{error.target.ayah}</b>
        <p>{error.note||'بدون ملاحظة إضافية'}</p>
      </div>):<p className={css.hint}>لا توجد أخطاء موثقة في هذه المعاينة.</p>}
    </div>}
    {tab==='notes'&&<div className={css.tabBody}>
      <label className={css.field}>ملاحظات الشيخ الخاصة
        <textarea rows={7} maxLength={1000} value={notes} disabled={room.phase==='waiting'}
          onChange={e=>changeNotes(e.target.value)} placeholder="خطة المراجعة والملاحظات قبل اعتماد التقرير..."/>
      </label>
      <p className={css.hint}>هذه مسودة محلية لا يراها الطالب. النشر لاحقًا يكون باختيار الشيخ واعتماد التقرير.</p>
      <div className={css.panelHeading}><strong>علامات مشتركة ظاهرة</strong><small>{records.filter(r=>r.visible).length}</small></div>
      {records.filter(r=>r.visible).slice(-8).map(record=><div key={record.stroke.id} className={css.inkAuditRow}>
        <span>{record.author==='teacher'?'رسم الشيخ':'رسم الطالب'} · صفحة {record.page}</span>
        <button type="button" disabled={room.phase!=='live'} onClick={()=>hideStroke(record.stroke.id)}>إخفاء</button>
      </div>)}
      <p className={css.hint}>الإخفاء لا يحذف سجل العملية. ملاحظات الطالب الخاصة غير مدرجة هنا أصلًا.</p>
    </div>}
    {tab==='draft'&&<div className={css.tabBody}>
      <p className={css.hint}>تقييمات مستقلة من ١٠، ويمكن ترك أي معيار غير مُقيَّم دون حساب متوسط.</p>
      {grades.map(item=><label key={item.id} className={css.field}>{item.label}
        <select value={scores[item.id]??''} disabled={room.phase==='waiting'}
          onChange={e=>grade(item.id,e.target.value===''?null:Number(e.target.value))}>
          <option value="">لم يُقيّم</option>
          {Array.from({length:11},(_,i)=><option key={i} value={i}>{i} / 10</option>)}
        </select>
      </label>)}
      {room.phase==='ended'&&<div className={css.successNote}>أنهيت الحصة يدويًا. هذه الدرجات ما زالت مسودة محلية وتحتاج اعتماد تقرير الشيخ على الخادم.</div>}
      <p className={css.hint}>يجب أن يُنشئ الـBackend مسودة تقرير مرتبطة بإصدار أرشيف المصحف، ولا يظهر للطالب إلا أحدث إصدار اعتمده الشيخ.</p>
    </div>}
    <details className={css.auditDetails}><summary>سجل العمليات التجريبي ({audit.length})</summary>
      {audit.length?audit.slice(0,12).map(item=><p key={item.id}>{item.summary} · {item.actor==='teacher'?'الشيخ':'الطالب'}</p>):<p>لا توجد عمليات حتى الآن.</p>}
    </details>
  </aside>;
}
