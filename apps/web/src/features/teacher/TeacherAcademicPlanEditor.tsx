'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {academicPlanClient,planMessage,type AcademicPlan,type AcademicPlanInput} from '../shared/index';
import css from './TeacherReadOnly.module.css';

type Reading={status:'loading'}|{status:'error'}|{status:'loaded';plan:AcademicPlan|null};
const client=academicPlanClient();
const empty:AcademicPlanInput={level:'beginner',nextWird:'',revisionWird:'',focus:''};
const levels={beginner:'مبتدئ',intermediate:'متوسط',advanced:'متقدم'};
export function TeacherAcademicPlanEditor({learnerId,learnerName}:{learnerId:string;learnerName:string}){
 const [reading,setReading]=useState<Reading>({status:'loading'});
 const [draft,setDraft]=useState<AcademicPlanInput>(empty),[editing,setEditing]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);
 const mutating=useRef(false),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let alive=true;const controller=new AbortController();
  setReading({status:'loading'});setEditing(false);setUncertain(false);setMessage('');
  void client.teacherPlan(learnerId,controller.signal).then(plan=>{
   if(!alive||controller.signal.aborted)return;
   setReading({status:'loaded',plan});
   setDraft(plan?{level:plan.level,nextWird:plan.nextWird,revisionWird:plan.revisionWird,focus:plan.focus}:empty);
  }).catch(error=>{
   if(!alive||controller.signal.aborted)return;
   setMessage(planMessage(error));setReading({status:'error'});
  });
  return()=>{alive=false;controller.abort();};
 },[learnerId,refresh]);
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(mutating.current||uncertain||reading.status!=='loaded')return;
  mutating.current=true;setBusy(true);setMessage('');
  const revision=reading.plan?.revision??0;
  try{
   const valid={level:draft.level,nextWird:draft.nextWird.trim(),revisionWird:draft.revisionWird.trim(),focus:draft.focus.trim()};
   await client.save(learnerId,valid,revision,crypto.randomUUID());
   const fresh=await client.teacherPlan(learnerId);
   if(!fresh||fresh.revision!==revision+1)throw new Error('Missing saved plan readback');
   setReading({status:'loaded',plan:fresh});setDraft(valid);
   setEditing(false);setMessage('تم تأكيد حفظ الخطة على الخادم.');
  }catch(error){
   setMessage(planMessage(error));setUncertain(true);
  }finally{mutating.current=false;setBusy(false);}
 }
 if(reading.status==='loading')return <section role="status" className={css.card}>جارٍ قراءة خطة {learnerName} من D1...</section>;
 if(reading.status==='error')return <section role="alert" className={css.card}>
  <p>{message}</p><button type="button" onClick={()=>setRefresh(k=>k+1)}>إعادة التحميل</button>
 </section>;
 return <section className={css.card} aria-label={'الخطة التعليمية للطالب '+learnerName}>
  <div className={css.heading}><h2>خطة {learnerName}</h2><span>{reading.plan?'الإصدار '+reading.plan.revision:'لم تُحفظ خطة بعد'}</span></div>
  {!editing?<div>
   {reading.plan?<><p><strong>المستوى:</strong> {levels[reading.plan.level]}</p>
    <p><strong>الورد القادم:</strong> {reading.plan.nextWird}</p>
    <p><strong>المراجعة:</strong> {reading.plan.revisionWird}</p>
    <p><strong>التركيز:</strong> {reading.plan.focus}</p></>:
    <p>لم يحدد الشيخ خطة لهذا الطالب بعد. لا توجد بيانات تعليمية مفترضة.</p>}
   <div className={css.actions}><button type="button" disabled={uncertain||busy} onClick={()=>setEditing(true)}> {reading.plan?'تعديل الخطة':'إنشاء خطة'} </button></div>
  </div>:<form onSubmit={save} style={{display:'grid',gap:12}}>
   <label>مستوى الطالب
    <select value={draft.level} disabled={busy||uncertain} onChange={e=>setDraft(p=>({...p,level:e.target.value as AcademicPlan['level']}))}>
     {Object.entries(levels).map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select></label>
   <label>ورد الحفظ القادم <textarea required maxLength={300} rows={2} disabled={busy||uncertain}
    value={draft.nextWird} onChange={e=>setDraft(p=>({...p,nextWird:e.target.value}))}/></label>
   <label>ورد المراجعة <textarea required maxLength={500} rows={3} disabled={busy||uncertain}
    value={draft.revisionWird} onChange={e=>setDraft(p=>({...p,revisionWird:e.target.value}))}/></label>
   <label>ملاحظة التركيز <textarea required maxLength={500} rows={3} disabled={busy||uncertain}
    value={draft.focus} onChange={e=>setDraft(p=>({...p,focus:e.target.value}))}/></label>
   <p>هذه خطة تعليمية محفوظة، وليست واجبًا منشورًا. لا يحدث نشر واجبات تلقائيًا.</p>
   <div className={css.actions}>
    <button disabled={busy||uncertain} type="submit">{busy?'جارٍ التحقق…':'حفظ الخطة'}</button>
    <button disabled={busy} type="button" onClick={()=>setEditing(false)}>إلغاء</button>
   </div>
  </form>}
  {message&&<p role="status">{message}</p>}
  {uncertain&&<div className={css.actions}><button type="button" onClick={()=>{setUncertain(false);setRefresh(v=>v+1);}}>تحديث النسخة من الخادم قبل أي تعديل آخر</button></div>}
 </section>;
}
