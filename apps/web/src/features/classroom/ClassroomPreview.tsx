'use client';
import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ReaderPrintedPage,targetKey} from '@/features/student';
import {ClassroomControls} from './ClassroomControls';
import {ClassroomSessionHeader} from './ClassroomSessionHeader';
import {ClassroomMedia} from './ClassroomMedia';
import {ClassroomSidePanel} from './ClassroomSidePanel';
import {useClassroomPreview} from './useClassroomPreview';
import css from './Classroom.module.css';

export function ClassroomPreview(){
  const model=useClassroomPreview();
  const rootRef=useRef<HTMLDivElement>(null);
  const [focusMode,setFocusMode]=useState(false);
  const [panelOpen,setPanelOpen]=useState(false);
  useEffect(()=>{
    const handler=()=>{ if(!document.fullscreenElement)setFocusMode(false); };
    document.addEventListener('fullscreenchange',handler);
    return ()=>document.removeEventListener('fullscreenchange',handler);
  },[]);
  async function toggleFocus(){
    if(focusMode){
      setFocusMode(false);
      if(document.fullscreenElement)await document.exitFullscreen().catch(()=>undefined);
    }else{
      setFocusMode(true);
      if(rootRef.current?.requestFullscreen)await rootRef.current.requestFullscreen().catch(()=>undefined);
    }
  }
  const {room,role,inkMode,inkColor,pageStrokes,target,setTarget,errors,updateInk,drawingAvailable,setPage}=model;
  const keys=useMemo(()=>new Set(errors.map(err=>targetKey(err.target))),[errors]);
  const mode=room.phase==='live'&&drawingAvailable?inkMode:'off';
  return <div ref={rootRef} className={[css.root,focusMode?css.focusMode:'',panelOpen?css.panelExpanded:''].filter(Boolean).join(' ')}
    data-view-role={role} data-focus={focusMode?'on':'off'}>
    <ClassroomSessionHeader model={model} focusMode={focusMode}
      onToggleFocus={()=>void toggleFocus()} panelOpen={panelOpen}
      onTogglePanel={()=>setPanelOpen(value=>!value)}/>
    <ClassroomControls model={model}/>
    <div className={css.workspace}>
      <ClassroomMedia model={model}/>
      <main className={css.quranStage} aria-label="المصحف المشترك داخل الفصل">
        <header className={css.quranHead}>
          <div><span className={css.overline}>المصحف المعتمد · رواية حفص</span>
            <h2>المصحف المشترك</h2></div>
          <span className={css.quranStatus}>{role==='teacher'?'التنقل بإذن الشيخ':'لا يحق للطالب تغيير الصفحة'}</span>
        </header>
        <div className={css.quranViewport} data-quran-layout="viewport-fit">
          <button type="button" className={css.pageEdgePrev} title="الصفحة السابقة" aria-label="الصفحة السابقة"
            disabled={role!=='teacher'||room.phase!=='live'||room.currentPage<=1}
            onClick={()=>setPage(room.currentPage-1)}>‹</button>
          <ReaderPrintedPage page={room.currentPage} viewportFit inkMode={mode} color={inkColor}
            strokes={pageStrokes} selectedKey={target?targetKey(target):null} noteKeys={keys}
            onSelect={setTarget} onOpenNote={setTarget}
            onInkChange={updateInk}/>
          <button type="button" className={css.pageEdgeNext} title="الصفحة التالية" aria-label="الصفحة التالية"
            disabled={role!=='teacher'||room.phase!=='live'||room.currentPage>=604}
            onClick={()=>setPage(room.currentPage+1)}>›</button>
        </div>
        <footer className={css.quranFooter}>
          <span>الصفحة {room.currentPage} من ٦٠٤ · التحديد والتظليل فوق طبقة منفصلة عن نص المصحف</span>
          {target&&<span>الآية المحددة: {target.surah}:{target.ayah}</span>}
        </footer>

        {room.phase==='ended'&&<div className={css.stageNotice}>
          انتهى الفصل يدويًا في المعاينة. تظل التصحيحات والتقييمات هنا محلية؛ التقرير الحقيقي يحتاج مراجعة الشيخ واعتماده.
          <Link href="/teacher/reports">فتح صفحة تقارير الشيخ</Link>
        </div>}
      </main>
      <div className={css.panelSlot} id="lesson-notes" data-open={panelOpen?'true':'false'}>
        <ClassroomSidePanel model={model}/>
      </div>
    </div>
    <p className={css.disclaimer}>هذه واجهة تفاعلية تجريبية على نفس مكوّن المصحف المستخدم في المنصة. لن تُرسل الرسومات إلى الطالب، ولا تُنشأ غرفة LiveKit، ولا تُسجل درجات في D1 قبل اكتمال التكامل المصرح به. كل العمليات المحفوظة هنا في ذاكرة المعاينة فقط.</p>
  </div>;
}
