'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {AssignmentDraft} from '../shared';
import {assignmentClient} from '../shared';
import {ReaderPrintedPage,targetKey,type QuranInkStroke,type QuranTarget} from '@/features/student';
import {teacherInkDraftClient,type SavedInkDraft,type TeacherInkMark,
 type PageRange} from './teacher-ink-draft-client';
import css from './TeacherReadOnly.module.css';

type Props=Readonly<{learnerId:string;initial:AssignmentDraft;existing?:SavedInkDraft;
 onCancel:()=>void;onSaved:(draft:SavedInkDraft)=>void;onPublished:()=>void}>;
const colors=[['#d0a94c','ذهبي'],['#388e68','أخضر'],['#e2604e','أحمر'],
 ['#397ca7','أزرق'],['#8d67b0','بنفسجي']] as const;
const inkStrokes=(marks:readonly TeacherInkMark[],page:number):QuranInkStroke[]=>
 marks.filter(m=>m.page===page&&(m.kind==='pen'||m.kind==='marker')).map(m=>({
  id:m.id,page:m.page,kind:m.kind as 'pen'|'marker',
  color:m.payload.color as string,width:m.payload.width as number,
  points:m.payload.points as {x:number;y:number}[],
 }));
const safeError=(e:unknown)=>e instanceof Error?e.message:'DRAFT_UNAVAILABLE';
/** Explicit discard is mandatory for an unpublished, dirty ink editor. */
export function inkEditorExitDecision(dirty:boolean,busy:boolean,pendingNote=false):
 'blocked'|'confirm'|'close'{
 if(busy)return 'blocked';
 return dirty||pendingNote?'confirm':'close';
}
/** A typed but unattached verse note is not part of the saved marks JSON. */
export function inkEditorCanSave(dirty:boolean,busy:boolean,pendingNote:boolean){
 return dirty&&!busy&&!pendingNote;
}
export function inkEditorCanPublish(dirty:boolean,busy:boolean,pendingNote:boolean,hasSaved:boolean){
 return !dirty&&!busy&&!pendingNote&&hasSaved;
}

export function TeacherAssignmentInkEditor({learnerId,initial,existing,onCancel,onSaved,onPublished}:Props){
 const [stored,setStored]=useState<SavedInkDraft|null>(existing??null);
 const [marks,setMarks]=useState<TeacherInkMark[]>(existing?[...existing.marks]:[]);
 const [range,setRange]=useState<PageRange|null>(null);
 const [page,setPage]=useState(1);
 const [mode,setMode]=useState<'off'|'pen'|'marker'|'eraser'>('off');
 const [color,setColor]=useState('#d0a94c');
 const [selected,setSelected]=useState<QuranTarget|null>(null);
 const [noteText,setNoteText]=useState('');
 const [dirty,setDirty]=useState(!existing);
 const [confirmDiscard,setConfirmDiscard]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const inFlight=useRef(false);
 const draftIdRef=useRef<string>(existing?.draftId??'');
 const operationIdRef=useRef('');
 const input:AssignmentDraft=existing??initial;
 const pendingNote=noteText.length>0;
 const hasUnsaved=dirty||pendingNote;
 const chooseVerse=(target:QuranTarget|null)=>{
  // A note typed for verse A must not be reassigned to verse B just by tapping.
  if(pendingNote&&selected&&(target?.page!==selected.page||
    target?.surah!==selected.surah||target?.ayah!==selected.ayah)){
   setError('أضف الملاحظة للآية الحالية أو امسح النص قبل اختيار آية مختلفة.');
   return;
  }
  setSelected(target);
 };
 // Do not silently discard private corrections when closing the editor.
 // The caller must explicitly confirm loss of any unpublished changes.
 const requestClose=()=>{
  const action=inkEditorExitDecision(dirty,busy||inFlight.current,pendingNote);
  if(action==='confirm')setConfirmDiscard(true);
  if(action==='close')onCancel();
 };
 useEffect(()=>{
  if(!hasUnsaved)return;
  const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',warn);
  return()=>window.removeEventListener('beforeunload',warn);
 },[hasUnsaved]);

 useEffect(()=>{
  const abort=new AbortController();
  setRange(null);setError('');
  void teacherInkDraftClient.range(learnerId,input,abort.signal).then(result=>{
   if(!abort.signal.aborted){setRange(result);setPage(result.startPage);}
  }).catch(e=>{if(!abort.signal.aborted)setError('تعذّر تحديد صفحات الواجب من المصحف المعتمد: '+safeError(e));});
  return()=>abort.abort();
 },[learnerId,input.kind,input.editionId,input.surah,input.fromAyah,input.toAyah,
  input.dueAtMs,input.instructions]);
 const pageStrokes=useMemo(()=>inkStrokes(marks,page),[marks,page]);
 const noteKeys=useMemo(()=>new Set(marks.filter(m=>m.kind==='note'&&m.page===page&&
  m.surah!==null&&m.ayah!==null).map(m=>m.surah+':'+m.ayah)),[marks,page]);
 const chosen=selected?.surah===input.surah&&selected.ayah>=input.fromAyah&&
  selected.ayah<=input.toAyah&&selected.page===page?selected:null;
 const draw=(targetPage:number,strokes:QuranInkStroke[])=>{
  if(!range||busy||targetPage!==page)return;
  const other=marks.filter(m=>m.page!==page||(m.kind!=='pen'&&m.kind!=='marker'));
  const next:TeacherInkMark[]=strokes.map(s=>({
   id:s.id.slice(0,40),kind:s.kind,page:s.page,surah:null,ayah:null,
   payload:{color:s.color,width:s.width,
    // Pointer input may contain 2500 samples; the D1 draft cap is 600.
    points:s.points.length<=600?s.points:Array.from({length:600},(_,i)=>
      s.points[Math.round(i*(s.points.length-1)/599)]!)}
  }));
  if(next.length+other.length>24){setError('الحد الأقصى 24 علامة للواجب؛ احذف بعض العلامات.');return;}
  setMarks([...other,...next]);setDirty(true);setSuccess('');setError('');
 };
 const addVerse=(kind:'note'|'highlight')=>{
  if(!chosen||busy)return;
  if(marks.length>=24){setError('بلغت الحد الأقصى لعلامات الواجب.');return;}
  if(kind==='note'&&!noteText.trim()){setError('اكتب ملاحظة الشيخ أولًا.');return;}
  setMarks(v=>[...v,{id:'mk-'+crypto.randomUUID(),kind,page,
   surah:chosen.surah,ayah:chosen.ayah,
   payload:kind==='note'?{color,text:noteText.trim()}:{color}}]);
  setDirty(true);setSuccess('');setError('');
  // Highlighting a verse must not erase a note typed but not yet attached.
  if(kind==='note')setNoteText('');
 };
 const save=async()=>{
  if(inFlight.current||!range||busy)return;
  if(pendingNote){
   setError('هناك ملاحظة مكتوبة لم تُضف للمصحف. أضفها للآية أو امسحها قبل الحفظ.');
   return;
  }
  if(!dirty)return;
  inFlight.current=true;setBusy(true);setError('');setSuccess('');
  try{
   if(!draftIdRef.current)draftIdRef.current=crypto.randomUUID();
   const saved=await teacherInkDraftClient.save(learnerId,input,draftIdRef.current,
    (stored?.revision??0)+1,marks);
   setStored(saved);setDirty(false);setConfirmDiscard(false);onSaved(saved);
   setSuccess('المسودة والعلامات محفوظة للشيخ فقط، ولم تُنشر للطالب.');
  }catch(e){
   setError('تعذّر تأكيد حفظ المسودة. لا تعِد إنشاءها برقم جديد؛ حدّث المسودات للتحقق: '+safeError(e));
  }finally{inFlight.current=false;setBusy(false);}
 };
 const publish=async()=>{
  if(inFlight.current||busy||dirty||pendingNote||!stored)return;
  inFlight.current=true;setBusy(true);setError('');setSuccess('');
  try{
   if(!operationIdRef.current)operationIdRef.current=crypto.randomUUID();
   await assignmentClient().publish(learnerId,input,operationIdRef.current,stored.draftId);
   setSuccess('نُشر الواجب والعلامات معًا في المصحف الدائم.');
   onPublished();
  }catch(e){
   setError('نتيجة النشر غير مؤكدة؛ تحقّق من السجل قبل إنشاء عملية أخرى: '+safeError(e));
  }finally{inFlight.current=false;setBusy(false);}
 };
 return <section className={css.card} dir="rtl" aria-label="تحضير علامات واجب المصحف">
  <div className={css.heading}><h2>تحضير علامات الواجب</h2>
   <span>مسودة خاصة بالشيخ حتى النشر</span></div>
  <p>سورة {input.surah} · الآيات {input.fromAyah}–{input.toAyah}.
    قلم وماركر على صفحات النطاق، وملاحظات أو تظليل على الآيات المحددة.</p>
  {!range?<p role="status">جارٍ التحقق من نطاق المصحف المعتمد…</p>:<>
   <div className={css.actions} role="toolbar" aria-label="أدوات رسم الواجب">
    {([{key:'off',text:'تحديد آية'},{key:'pen',text:'قلم'},
      {key:'marker',text:'ماركر'},{key:'eraser',text:'ممحاة'}] as const).map(item=>
     <button key={item.key} type="button" disabled={busy}
      aria-pressed={mode===item.key} onClick={()=>setMode(item.key)}>{item.text}</button>)}
   </div>
   <div className={css.actions} role="group" aria-label="ألوان القلم">
    {colors.map(([id,label])=><button key={id} type="button" disabled={busy}
     aria-label={'لون '+label} aria-pressed={color===id}
     style={{background:id,color:'#fff'}} onClick={()=>setColor(id)}>{label}</button>)}
   </div>
   <div className={css.actions} role="group" aria-label="صفحات الواجب">
    <button type="button" disabled={busy||pendingNote||page<=range.startPage}
     onClick={()=>{setPage(p=>p-1);setSelected(null);setMode('off');}}>الصفحة السابقة</button>
    <strong>صفحة {page} من {range.startPage} إلى {range.endPage}</strong>
    <button type="button" disabled={busy||pendingNote||page>=range.endPage}
     onClick={()=>{setPage(p=>p+1);setSelected(null);setMode('off');}}>الصفحة التالية</button>
   </div>
   <div style={{maxWidth:520,marginInline:'auto',width:'100%'}}>
    <ReaderPrintedPage page={page} inkMode={busy?'off':mode} color={color}
     strokes={pageStrokes} selectedKey={chosen?targetKey(chosen):null}
     noteKeys={noteKeys} onSelect={chooseVerse} onOpenNote={chooseVerse}
     onInkChange={draw}/>
   </div>
   <div className={css.actions}>
    <label style={{flex:1}}>ملاحظة على الآية المختارة
     <textarea rows={2} maxLength={500} disabled={busy||!chosen} value={noteText}
      onChange={e=>{setNoteText(e.target.value);setSuccess('');setConfirmDiscard(false);}}
      placeholder={chosen?'ملاحظة الشيخ على '+chosen.surah+':'+chosen.ayah:'حدد آية من المصحف أولًا'} />
    </label>
   </div>
   {pendingNote&&<p role="status">الملاحظة المكتوبة لم تُضف بعد للآية ولن تدخل في حفظ المسودة.
    أضف الملاحظة أو امسح النص قبل الحفظ أو النشر أو تغيير الصفحة.</p>}
   {pendingNote&&<button type="button" disabled={busy} onClick={()=>{
    setNoteText('');setError('');setConfirmDiscard(false);
   }}>مسح نص الملاحظة غير المضافة</button>}
   <div className={css.actions}>
    <button type="button" disabled={!chosen||busy||!noteText.trim()} onClick={()=>addVerse('note')}>
     إضافة ملاحظة</button>
    <button type="button" disabled={!chosen||busy} onClick={()=>addVerse('highlight')}>
     تظليل الآية المحددة</button>
    <button type="button" disabled={busy||marks.length===0} onClick={()=>{
     setMarks(v=>v.slice(0,-1));setDirty(true);setSuccess('');
    }}>تراجع عن آخر علامة</button>
   </div>
   <p role="status">{marks.length} من 24 علامة · {pendingNote?'ملاحظة لم تُضف للآية':dirty?'تغييرات غير محفوظة':'آخر نسخة محفوظة للشيخ'}</p>
   <div className={css.actions}>
    <button type="button" disabled={!inkEditorCanSave(dirty,busy,pendingNote)} onClick={()=>void save()}>
     {busy?'جارٍ التحقق…':'حفظ مسودة العلامات'}</button>
    <button type="button" disabled={!inkEditorCanPublish(dirty,busy,pendingNote,!!stored)} onClick={()=>void publish()}>
     نشر الواجب وعلاماته للطالب</button>
   </div>
  </>}
  {/* Leave a way out even when the authorized Quran-page-range request fails. */}
  <button type="button" disabled={busy} onClick={requestClose}
   aria-expanded={confirmDiscard&&hasUnsaved}>إغلاق المحرر</button>
  {confirmDiscard&&hasUnsaved&&<div role="alertdialog"
   aria-labelledby="ink-discard-title" aria-describedby="ink-discard-detail">
   <strong id="ink-discard-title">تغييرات علامات المصحف غير محفوظة</strong>
   <p id="ink-discard-detail">إغلاق المحرر الآن سيفقد آخر علامات أو ملاحظات
    غير محفوظة. لن تُرسل للطالب أو تُحفظ على الخادم.</p>
   <div className={css.actions}>
    <button type="button" disabled={busy} onClick={()=>setConfirmDiscard(false)}>
     متابعة تحرير العلامات</button>
    <button type="button" disabled={busy} onClick={onCancel}>
     تجاهل التغييرات وإغلاق المحرر</button>
   </div>
  </div>}
  {error&&<p role="alert">{error}</p>}
  {success&&<p role="status">{success}</p>}
  <small>لا تظهر أي علامة للطالب قبل نشر الواجب، ولا يتم تحويل مسودات الشيخ إلى بيانات الطالب تلقائيًا.</small>
 </section>;
}
