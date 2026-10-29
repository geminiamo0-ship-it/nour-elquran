'use client';
import Link from 'next/link';
import {useMemo} from 'react';
import {ReaderPrintedPage,targetKey} from '@/features/student';
import {ClassroomControls} from './ClassroomControls';
import {ClassroomMedia} from './ClassroomMedia';
import {ClassroomSidePanel} from './ClassroomSidePanel';
import {useClassroomPreview} from './useClassroomPreview';
import css from './Classroom.module.css';

export function ClassroomPreview(){
  const model=useClassroomPreview();
  const {room,role,inkMode,inkColor,pageStrokes,target,setTarget,errors,updateInk,drawingAvailable}=model;
  const keys=useMemo(()=>new Set(errors.map(err=>targetKey(err.target))),[errors]);
  const mode=room.phase==='live'&&drawingAvailable?inkMode:'off';
  return <div className={css.root}>
    <div className={css.pageTop}><Link href="/teacher">العودة إلى بوابة الشيخ</Link>
      <span>الفصل التجريبي · مسار مستقل عن جلسات الطلاب الحقيقية</span></div>
    <ClassroomControls model={model}/>
    <div className={css.workspace}>
      <ClassroomMedia model={model}/>
      <main className={css.quranStage} aria-label="المصحف المشترك داخل الفصل">
        <header className={css.quranHead}>
          <div><span className={css.overline}>المصحف المعتمد · رواية حفص</span>
            <h2>المصحف المشترك</h2></div>
          <span className={css.quranStatus}>{role==='teacher'?'التنقل بإذن الشيخ':'لا يحق للطالب تغيير الصفحة'}</span>
        </header>
        <div className={css.quranViewport}>
          <ReaderPrintedPage page={room.currentPage} inkMode={mode} color={inkColor}
            strokes={pageStrokes} selectedKey={target?targetKey(target):null} noteKeys={keys}
            onSelect={setTarget} onOpenNote={setTarget}
            onInkChange={updateInk}/>
        </div>
        <footer className={css.quranFooter}>
          <span>الصفحة {room.currentPage} من ٦٠٤ · التحديد والتظليل فوق طبقة منفصلة عن نص المصحف</span>
          {target&&<span>الآية المحددة: {target.surah}:{target.ayah}</span>}
        </footer>
        {room.phase==='waiting'&&<div className={css.stageNotice}>في انتظار وجود الشيخ والطالب، ثم يضغط الشيخ «بدء الحصة». لا يبدأ الفصل تلقائيًا.</div>}
        {room.phase==='ended'&&<div className={css.stageNotice}>
          انتهى الفصل يدويًا في المعاينة. تظل التصحيحات والتقييمات هنا محلية؛ التقرير الحقيقي يحتاج مراجعة الشيخ واعتماده.
          <Link href="/teacher/reports">فتح صفحة تقارير الشيخ</Link>
        </div>}
      </main>
      <ClassroomSidePanel model={model}/>
    </div>
    <p className={css.disclaimer}>هذه واجهة تفاعلية تجريبية على نفس مكوّن المصحف المستخدم في المنصة. لن تُرسل الرسومات إلى الطالب، ولا تُنشأ غرفة LiveKit، ولا تُسجل درجات في D1 قبل اكتمال التكامل المصرح به. كل العمليات المحفوظة هنا في ذاكرة المعاينة فقط.</p>
  </div>;
}
