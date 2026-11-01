'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {notebookClient,notebookError,lessonReportsClient,
 type LessonRow,type PrivateNote,type StudentReport} from '../../shared';
import styles from '../StudentPortal.module.css';
import {PublishedLessonArchive} from './PublishedLessonArchive';
import {LessonQuranHistory} from './LessonQuranHistory';

type Loaded={status:'ready';lessons:readonly LessonRow[];reports:readonly StudentReport[]};
type State=Loaded|{status:'loading'|'error'};
const date=(ms:number)=>new Intl.DateTimeFormat('ar-EG',{
 timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short',
}).format(new Date(ms));
const grade=(value:number|null)=>value===null?'لم يُقيَّم':value+' / 10';
export function ConnectedNotebookWorkspace({learnerId}:{learnerId:string}){
 const [state,setState]=useState<State>({status:'loading'});
 const [reload,setReload]=useState(0);
 const [selectedId,setSelectedId]=useState('');
 const [notes,setNotes]=useState<readonly PrivateNote[]>([]);
 const [notesState,setNotesState]=useState<'loading'|'loaded'|'error'>('loading');
 const [notesReload,setNotesReload]=useState(0);
 const [body,setBody]=useState('');
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [message,setMessage]=useState('');
 const inFlight=useRef(false);
 useEffect(()=>{
  let alive=true;const controller=new AbortController();
  setState({status:'loading'});setSelectedId('');setNotes([]);
  setBody('');setMessage('');setUncertain(false);
  void Promise.all([
   notebookClient.lessons(learnerId,controller.signal),
   lessonReportsClient.student(learnerId,controller.signal),
  ]).then(([lessons,reports])=>{
   if(alive&&!controller.signal.aborted){
    setState({status:'ready',lessons:lessons.filter(l=>l.status==='completed'&&l.learnerId===learnerId),
     reports:reports.filter(r=>r.learnerId===learnerId)});
   }
  }).catch(()=>{if(alive&&!controller.signal.aborted)setState({status:'error'});});
  return()=>{alive=false;controller.abort();};
 },[learnerId,reload]);
 const completed=state.status==='ready'?state.lessons:[];
 const selected=completed.find(l=>l.id===selectedId)??completed[0];
 const lessonId=selected?.id??'';
 const report=state.status==='ready'?state.reports.find(r=>r.lessonId===lessonId):undefined;
 useEffect(()=>{
  let alive=true;const controller=new AbortController();
  setNotes([]);setNotesState('loading');setMessage('');setUncertain(false);
  if(!lessonId){setNotesState('loaded');return()=>controller.abort();}
  void notebookClient.notes(learnerId,lessonId,controller.signal).then(rows=>{
   if(alive&&!controller.signal.aborted){setNotes(rows);setNotesState('loaded');}
  }).catch(()=>{if(alive&&!controller.signal.aborted)setNotesState('error');});
  return()=>{alive=false;controller.abort();};
 },[learnerId,lessonId,notesReload]);
 async function write(action:'put'|'hide',note?:PrivateNote){
  if(!selected||inFlight.current||uncertain||notesState!=='loaded')return;
  if(action==='put'&&(!body.trim()||body.length>500))return;
  inFlight.current=true;setBusy(true);setMessage('');
  try{
   if(action==='put')await notebookClient.save(learnerId,lessonId,crypto.randomUUID(),0,
      body.trim(),crypto.randomUUID());
   else if(note)await notebookClient.hide(learnerId,lessonId,note.id,note.version,crypto.randomUUID());
   else return;
   const refreshed=await notebookClient.notes(learnerId,lessonId);
   setNotes(refreshed);if(action==='put')setBody('');
   setMessage(action==='put'?'تم حفظ ملاحظتك الخاصة على الخادم.':'تم إخفاء الملاحظة وحفظ التغيير.');
  }catch(error){setUncertain(true);setMessage(notebookError(error));}
  finally{inFlight.current=false;setBusy(false);}
 }
 const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();void write('put');};
 return <div className={styles.workspace}>
  <section className={styles.panel}>
   <div className={styles.panelHead}><h2>تفاصيل الحصة</h2></div>
   {state.status==='loading'?<p role="status">جارٍ التحقق من حصص الطالب وتقاريره...</p>:
    state.status==='error'?<div role="alert"><p>تعذر تحميل دفتر الحصص الحقيقي.</p>
     <button type="button" onClick={()=>setReload(x=>x+1)}>إعادة المحاولة</button>
    </div>:
    !selected?<div className={styles.emptyBox}>لا توجد حصص مكتملة ومؤكدة لهذا الطالب حتى الآن.</div>:
    <>
     <label className={styles.formLabel} htmlFor="connected-notebook-lesson">اختر حصة مكتملة</label>
     <select id="connected-notebook-lesson" className={styles.selectField} value={lessonId}
      disabled={busy} onChange={e=>{setSelectedId(e.target.value);setBody('');}}>
      {completed.map(l=><option key={l.id} value={l.id}>
       {date(l.startsAtMs)} · {l.kind==='trial'?'تجريبية':l.kind==='makeup'?'تعويضية':'أساسية'}
      </option>)}
     </select>
     <div className={styles.noteSheet}>
      <strong>الحصة: {date(selected.startsAtMs)}</strong>
      {report?<div>
       <p><b>نطاق الحصة:</b> {report.scope}</p>
       <p>الحفظ: {grade(report.memorization)} · التلاوة: {grade(report.recitation)} · التجويد: {grade(report.tajweed)}</p>
       <p><b>نقاط القوة:</b> {report.strengths||'—'}</p>
       <p><b>مواضع التصحيح:</b> {report.corrections||'—'}</p>
       <p><b>المراجعة القادمة:</b> {report.nextPlan||'—'}</p>
      </div>:<p>انتهت الحصة، وتقرير الشيخ قيد الإعداد أو لم يُنشر بعد.</p>}
     </div>
     <LessonQuranHistory learnerId={learnerId} lessonId={lessonId}/>
     <PublishedLessonArchive learnerId={learnerId} lessonId={lessonId}
      reportRevision={report?.revision??null}/>
     <h3>ملاحظاتي الخاصة</h3>
     {notesState==='loading'?<p role="status">جارٍ تحميل ملاحظات الحصة...</p>:
      notesState==='error'?<div role="alert">
       <p>تعذر قراءة الملاحظات من الخادم.</p>
       <button type="button" onClick={()=>setNotesReload(v=>v+1)}>إعادة التحميل</button>
      </div>:
      <div className={styles.stack}>{notes.length?notes.map(n=><article className={styles.personalNote} key={n.id}>
       <p>{n.body}</p>
       <button type="button" className={styles.textButton} disabled={busy||uncertain}
        onClick={()=>void write('hide',n)}>إخفاء الملاحظة</button>
      </article>):<p>لا توجد ملاحظات خاصة محفوظة لهذه الحصة.</p>}</div>}
     <form className={styles.formCard} onSubmit={submit}>
      <label className={styles.formLabel} htmlFor="connected-notebook-draft">ملاحظة جديدة لهذه الحصة</label>
      <textarea id="connected-notebook-draft" rows={3} className={styles.textArea}
       maxLength={500} value={body} onChange={e=>setBody(e.target.value)}
       placeholder="ما الذي تريد مراجعته قبل الحصة التالية؟" disabled={busy||uncertain||notesState!=='loaded'}/>
      <div className={styles.actionRow}><span>{body.length} / 500</span>
       <button type="submit" className={styles.actionButton}
        disabled={!body.trim()||busy||uncertain||notesState!=='loaded'}>
        {busy?'جارٍ تأكيد الحفظ…':'حفظ ملاحظة على الخادم'}
       </button>
       {uncertain&&<button type="button" className={styles.actionButton} disabled={busy}
        onClick={()=>{setNotesReload(x=>x+1);setUncertain(false);}}>تحديث الملاحظات</button>}
      </div>
      {uncertain&&<p role="alert">نتيجة التغيير غير مؤكدة؛ اقرأ الملاحظات مجددًا قبل إعادة العملية.</p>}
      {message&&<p role="status">{message}</p>}
     </form>
    </>}
  </section>
 </div>;
}
