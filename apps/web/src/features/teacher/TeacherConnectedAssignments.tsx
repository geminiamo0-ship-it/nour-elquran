'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {assignmentClient,assignmentMessage,type AssignmentDraft,type AssignmentSource,
 type PublishedAssignment} from '../shared';
import type {TeacherRosterRow} from './teacher-read-api';
import css from './TeacherReadOnly.module.css';
const client=assignmentClient();
const kinds={memorization:'حفظ',revision:'مراجعة',recitation:'تلاوة'} as const;
type Loaded={status:'loaded';catalog:readonly AssignmentSource[];assignments:readonly PublishedAssignment[]};
type State=Loaded|{status:'loading'|'error'};
export function TeacherConnectedAssignments({learners}:{learners:readonly TeacherRosterRow[]}){
 const [learnerId,setLearnerId]=useState(learners[0]?.id??'');
 const [state,setState]=useState<State>({status:'loading'});
 const [retry,setRetry]=useState(0);
 const [kind,setKind]=useState<AssignmentDraft['kind']>('memorization');
 const [surah,setSurah]=useState(1),[from,setFrom]=useState(1),[to,setTo]=useState(1);
 const [due,setDue]=useState(''),[instructions,setInstructions]=useState('');
 const [saving,setSaving]=useState(false),[uncertain,setUncertain]=useState(false),[message,setMessage]=useState('');
 const inFlight=useRef(false);
 const authorized=learners.find(l=>l.id===learnerId);
 const selected=authorized?.id??learners[0]?.id??'';
 useEffect(()=>{
  let active=true;const abort=new AbortController();
  setState({status:'loading'});setMessage('');setUncertain(false);
  if(!selected){setState({status:'loaded',catalog:[],assignments:[]});return()=>abort.abort();}
  void Promise.all([client.catalog(abort.signal),client.teacher(selected,abort.signal)])
   .then(([catalog,assignments])=>{
     if(active&&!abort.signal.aborted){
      setState({status:'loaded',catalog,assignments});
      setSurah(catalog[0]?.surah??1);
     }
   }).catch(err=>{
     if(active&&!abort.signal.aborted){setState({status:'error'});setMessage(assignmentMessage(err));}
   });
  return()=>{active=false;abort.abort();};
 },[selected,retry]);
 if(!learners.length)return <section className={css.card}><h1>الواجبات والتسميعات</h1>
  <p>لا يوجد طلاب مسندون حاليًا. لا يمكن إصدار واجب من حساب غير مخول.</p></section>;
 const catalog=state.status==='loaded'?state.catalog:[];
 const unique=Array.from(new Set(catalog.map(x=>x.editionId)));
 const editionId=unique[0]??'';
 const editionSurahs=catalog.filter(x=>x.editionId===editionId);
 const current=editionSurahs.find(x=>x.surah===surah)??editionSurahs[0];
 async function publish(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!selected||inFlight.current||uncertain||state.status!=='loaded')return;
  inFlight.current=true;setSaving(true);setMessage('');
  try{
   if(!current||!due||!instructions.trim())throw new Error('Input missing');
   const dueAtMs=new Date(due+'T23:59:00').getTime();
   const input:AssignmentDraft={kind,editionId:current.editionId,surah:current.surah,
     fromAyah:from,toAyah:to,dueAtMs,instructions:instructions.trim()};
   await client.publish(selected,input,crypto.randomUUID());
   const fresh=await client.teacher(selected);
   setState({...state,assignments:fresh});setInstructions('');
   setMessage('تم نشر الواجب وتأكيده من الخادم. سيظهر للطالب في تدريباتي.');
  }catch(error){
   setMessage(assignmentMessage(error));setUncertain(true);
  }finally{inFlight.current=false;setSaving(false);}
 }
 return <section className={css.card} aria-label="الواجبات المنشورة للطلاب">
  <div className={css.heading}><h1>الواجبات والتسميعات</h1><span>تكليف رسمي لكل طالب</span></div>
  <p>كل واجب ينشر لطالب واحد بعد التحقق من صلاحية الشيخ ونطاق القرآن. التسليم الصوتي والتصحيح لم يُربطا بعد.</p>
  <label>اختر الطالب المسند
    <select value={selected} onChange={e=>setLearnerId(e.target.value)}>
      {learners.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
    </select></label>
  {state.status==='loading'?<p role="status">جارٍ تحميل الآيات والواجبات...</p>:
   state.status==='error'?<p role="alert">{message}</p>:
   <><form onSubmit={publish} style={{display:'grid',gap:10}}>
    <label>نوع الواجب <select value={kind} disabled={saving||uncertain}
      onChange={e=>setKind(e.target.value as AssignmentDraft['kind'])}>
      {Object.entries(kinds).map(([id,name])=><option key={id} value={id}>{name}</option>)}
    </select></label>
    <label>السورة (نطاق معتمد من D1)
     <select value={current?.surah??surah} disabled={saving||uncertain}
      onChange={e=>{setSurah(Number(e.target.value));setFrom(1);setTo(1);}}>
      {editionSurahs.map(row=><option key={row.surah} value={row.surah}>سورة {row.surah} · {row.ayahCount} آية</option>)}
     </select></label>
    <div className={css.actions}>
     <label>من آية <input required type="number" min={1} max={current?.ayahCount??1} value={from}
       disabled={saving||uncertain} onChange={e=>setFrom(Number(e.target.value))}/></label>
     <label>إلى آية <input required type="number" min={from} max={current?.ayahCount??1} value={to}
       disabled={saving||uncertain} onChange={e=>setTo(Number(e.target.value))}/></label>
    </div>
    <label>آخر موعد (قبل نهاية اليوم حسب جهاز الشيخ)
     <input required type="date" value={due} disabled={saving||uncertain}
       onChange={e=>setDue(e.target.value)}/></label>
    <label>تعليمات الواجب <textarea required maxLength={500} rows={3}
      value={instructions} disabled={saving||uncertain} onChange={e=>setInstructions(e.target.value)}/></label>
    <div className={css.actions}>
     <button type="submit" disabled={saving||uncertain||!current||!due||!instructions.trim()}>
       {saving?'جارٍ تأكيد النشر…':'نشر الواجب لهذا الطالب'}</button>
     <button type="button" onClick={()=>{setRetry(x=>x+1);setUncertain(false);}} disabled={saving}>تحديث الواجبات</button>
    </div>
   </form><h2>السجل المنشور</h2>
   {state.assignments.length?<div className={css.list}>{state.assignments.map(t=><article key={t.id} className={css.row}>
     <strong>{kinds[t.kind]} · سورة {t.surah} ({t.fromAyah}–{t.toAyah})</strong>
     <small>الموعد {new Date(t.dueAtMs).toLocaleDateString('ar-EG')} · منشور للخادم</small>
     <p>{t.instructions}</p>
   </article>)}</div>:<p className={css.empty}>لا توجد واجبات منشورة لهذا الطالب.</p>}</>}
  {message&&state.status!=='error'&&<p role="status">{message}</p>}
  {uncertain&&<p>نتيجة النشر غير مؤكدة. حدّث السجل قبل أي محاولة جديدة لمنع تكرار التكليف.</p>}
 </section>;
}
