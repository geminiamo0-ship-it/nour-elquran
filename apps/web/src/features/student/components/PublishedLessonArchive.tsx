'use client';
import {useEffect,useState} from 'react';
import {archiveStrokes,fetchPublishedQuranArchive,
 type PublishedQuranArchive} from '../../shared';
import {ReaderPrintedPage} from './ReaderPrintedPage';
import styles from '../StudentPortal.module.css';

/** Display-only published layer; never write back to QuranInk or student Mushaf. */
export function PublishedLessonArchive({learnerId,lessonId,reportRevision}:{
 learnerId:string;lessonId:string;reportRevision:number|null;
}){
 const [archive,setArchive]=useState<PublishedQuranArchive|null>(null);
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
 const [selectedPage,setSelectedPage]=useState<number|null>(null);
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  const abort=new AbortController();
  setStatus('loading');setArchive(null);setSelectedPage(null);
  if(reportRevision===null){setStatus('ready');return()=>abort.abort();}
  void fetchPublishedQuranArchive(learnerId,lessonId,abort.signal).then(result=>{
   if(abort.signal.aborted)return;
   // Fail closed on revision mismatch rather than showing an older teacher layer.
   if(result&&(result.lessonId!==lessonId||result.learnerId!==learnerId||
      result.reportRevision!==reportRevision))throw new Error('ARCHIVE_REVISION_MISMATCH');
   setArchive(result);setStatus('ready');
  }).catch(()=>{if(!abort.signal.aborted)setStatus('error');});
  return()=>abort.abort();
 },[learnerId,lessonId,reportRevision,refresh]);
 const page=archive?(selectedPage!==null&&archive.pages.includes(selectedPage)
  ?selectedPage:archive.pages[0]!):null;
 const marks=page===null?[]:archive!.marks.filter(x=>x.page===page);
 const annotated=new Set(marks.filter(m=>m.kind==='note'&&m.surah!==null)
  .map(m=>m.surah+':'+m.ayah));
 const focus=new Set(marks.filter(m=>m.kind==='highlight'&&m.surah!==null)
  .map(m=>m.surah+':'+m.ayah));
 return <section className={styles.panel} aria-label="أرشيف المصحف المعتمد للحصة">
  <h3>المصحف المشروح — نسخة الحصة</h3>
  {status==='loading'?<p role="status">جارٍ التحقق من أرشيف الحصة المنشور...</p>:
   status==='error'?<div role="alert">
    <p>تعذر التحقق من الأرشيف على الخادم؛ لم تُعرض أي علامات غير معتمدة.</p>
    <button type="button" onClick={()=>setRefresh(v=>v+1)}>إعادة المحاولة</button>
   </div>:!archive||page===null?<p className={styles.muted}>
    {reportRevision===null
     ?'تقرير الحصة لم يُنشر بعد، لذلك لا يوجد أرشيف معتمد للعرض.'
     :'لم تُحفظ نسخة مصحف معتمدة لهذه الحصة بعد. العلامات الخاصة في مصحف الطالب ليست بديلًا عن أرشيف الشيخ.'}
   </p>:<>
    <p className={styles.muted}>طبقة الشيخ المختومة للقراءة فقط · إصدار التقرير {archive.reportRevision}.
     صفحة المصحف هي نفس الطبعة الأصلية، دون نسخ أو تعديل الآيات.</p>
    <label className={styles.formLabel} htmlFor="lesson-archive-page">الصفحات المعتمدة لهذه الحصة</label>
    <select className={styles.selectField} id="lesson-archive-page" value={page}
     onChange={e=>setSelectedPage(Number(e.target.value))}>
     {archive.pages.map(p=><option value={p} key={p}>صفحة {p}</option>)}
    </select>
    <div style={{maxWidth:460,marginInline:'auto'}}>
     <ReaderPrintedPage key={page} page={page} inkMode="off" color="#000000"
      viewportFit={false} strokes={archiveStrokes(archive,page)}
      selectedKey={null} noteKeys={annotated} focusKeys={focus}
      onSelect={()=>{}} onOpenNote={()=>{}} onInkChange={()=>{}}/>
    </div>
    <h4>التصحيحات المرتبطة بالآيات</h4>
    {marks.filter(m=>m.kind==='note').length?
     <ul>{marks.filter(m=>m.kind==='note').map(m=><li key={m.id}>
      سورة {m.surah} · آية {m.ayah}: {m.payload.text}
     </li>)}</ul>:
     <p className={styles.muted}>لا توجد تعليقات نصية معتمدة في هذه الصفحة.</p>}
    <p className={styles.muted}>طبقة الشيخ ثابتة ولا يمكن محوها من هنا. ملاحظاتك الشخصية تُحفظ بشكل مستقل أسفل الدفتر.</p>
   </>}
 </section>;
}
