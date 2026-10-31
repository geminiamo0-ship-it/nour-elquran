'use client';
import {useEffect,useMemo,useState} from 'react';
import {canonicalInk} from '../cumulative-quran-client';
import {fetchLessonQuranHistory,type LessonQuranHistory} from '../lesson-quran-history-client';
import type {QuranInkStroke} from '../quranAnnotations';
import {ReaderPrintedPage} from './ReaderPrintedPage';
import styles from '../StudentPortal.module.css';

type Load={scope:string;status:'loading'|'ready'|'error';data:LessonQuranHistory|null};
/** Historical, owner-only view. Never fetch the current cumulative projection:
 * later Sheikh edits must not appear as though they were in this old lesson.
 */
export function LessonQuranHistory({learnerId,lessonId}:{
 learnerId:string;lessonId:string;
}){
 const scope=learnerId+':'+lessonId;
 const [index,setIndex]=useState<Load|null>(null);
 const [page,setPage]=useState<number|null>(null);
 const [marks,setMarks]=useState<Load|null>(null);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const abort=new AbortController();
  setIndex({scope,status:'loading',data:null});setPage(null);setMarks(null);
  void fetchLessonQuranHistory(learnerId,lessonId,null,abort.signal).then(data=>{
   if(!abort.signal.aborted){setIndex({scope,status:'ready',data});
    setPage(data.pages[0]??null);}
  }).catch(()=>{if(!abort.signal.aborted)setIndex({scope,status:'error',data:null});});
  return()=>abort.abort();
 },[learnerId,lessonId,scope,retry]);
 useEffect(()=>{
  if(page===null)return;
  const abort=new AbortController(),key=scope+':'+page;
  setMarks({scope:key,status:'loading',data:null});
  void fetchLessonQuranHistory(learnerId,lessonId,page,abort.signal).then(data=>{
   if(!abort.signal.aborted)setMarks({scope:key,status:'ready',data});
  }).catch(()=>{if(!abort.signal.aborted)setMarks({scope:key,status:'error',data:null});});
  return()=>abort.abort();
 },[learnerId,lessonId,scope,page,retry]);
 const valid=index?.scope===scope?index:null;
 const current=marks?.scope===scope+':'+page?marks:null;
 const history=valid?.status==='ready'?valid.data:null;
 const data=current?.status==='ready'?current.data:null;
 const strokes=useMemo(()=>data?.marks.map(canonicalInk)
  .filter((m):m is QuranInkStroke=>m!==null)??[],[data]);
 const notes=useMemo(()=>data?.marks.filter(m=>m.kind==='note'&&m.surah!==null&&
  m.ayah!==null)??[],[data]);
 const noteKeys=new Set(notes.map(m=>m.surah+':'+m.ayah));
 const focusKeys=new Set(data?.marks.filter(m=>m.kind==='highlight'&&m.surah!==null)
  .map(m=>m.surah+':'+m.ayah)??[]);
 return <section className={styles.panel} aria-label="علامات المصحف وقت الحصة">
  <h3>علامات المصحف وقت هذه الحصة</h3>
  <p className={styles.muted}>عرض تاريخي للعلامات التعليمية المشتركة حتى نهاية الحصة فقط.
   لا يُظهر تعديلات الحصص اللاحقة ولا ملاحظات التدريب الخاصة، وليس أرشيفًا مختومًا أو ملف PDF.</p>
  {valid?.status==='loading'||!valid?<p role="status">جارٍ تحميل صفحات الحصة من السجل المعتمد...</p>:
   valid.status==='error'?<div role="alert"><p>تعذر التحقق من سجل علامات الحصة.</p>
    <button type="button" onClick={()=>setRetry(v=>v+1)}>إعادة المحاولة</button></div>:
   !history?.pages.length?<p className={styles.muted}>لا توجد علامات مشتركة محفوظة من هذه الحصة في السجل التراكمي حتى الآن.</p>:
   <>
    <label className={styles.formLabel} htmlFor="lesson-history-page">الصفحات التي عليها علامات من هذه الحصة</label>
    <select id="lesson-history-page" className={styles.selectField}
     value={page??history.pages[0]!} onChange={e=>setPage(Number(e.target.value))}>
     {history.pages.map(p=><option key={p} value={p}>صفحة {p}</option>)}
    </select>
    {current?.status==='error'?<div role="alert"><p>تعذر تحميل العلامات التاريخية لهذه الصفحة.</p>
     <button type="button" onClick={()=>setRetry(v=>v+1)}>إعادة المحاولة</button></div>:
     !data||page===null?<p role="status">جارٍ استعادة حالة الصفحة وقت انتهاء الحصة...</p>:
     data.asOfMs!==history.asOfMs?<p role="alert">تعارض في نقطة استرجاع الحصة؛ أعد التحميل.</p>:
     <>
      <p className={styles.muted}>الحالة عند انتهاء الحصة: {new Date(data.asOfMs).toLocaleString('ar-EG')}</p>
      <div style={{maxWidth:460,marginInline:'auto'}}>
       <ReaderPrintedPage key={page} page={page} inkMode="off" color="#000000"
        strokes={strokes} selectedKey={null} noteKeys={noteKeys} focusKeys={focusKeys}
        onSelect={()=>{}} onOpenNote={()=>{}} onInkChange={()=>{}}/>
      </div>
      {notes.length>0&&<div><h4>الملاحظات المرتبطة بالآيات</h4>
       <ul>{notes.map(m=><li key={m.itemId}>سورة {m.surah} · آية {m.ayah}:
        {typeof m.payload.text==='string'?m.payload.text:''}</li>)}</ul></div>}
     </>
    }
   </>}
 </section>;
}
