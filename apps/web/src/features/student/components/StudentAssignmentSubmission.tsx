'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {assignmentAttemptClient,assignmentMessage,type AssignmentAttempt} from '../../shared';
import css from './TrainingWorkspace.module.css';
const client=assignmentAttemptClient();
type State={phase:'loading'|'loaded'|'error';attempts:readonly AssignmentAttempt[]};
export function StudentAssignmentSubmission({learnerId,assignmentId}:{learnerId:string;assignmentId:string}){
 const [data,setData]=useState<State>({phase:'loading',attempts:[]});
 const [note,setNote]=useState(''),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);
 const [saving,setSaving]=useState(false),[refresh,setRefresh]=useState(0);
 const busy=useRef(false);
 useEffect(()=>{
  let live=true;const controller=new AbortController();
  setData({phase:'loading',attempts:[]});setMessage('');
  void client.studentAttempts(learnerId,assignmentId,controller.signal).then(attempts=>{
   if(live&&!controller.signal.aborted){setData({phase:'loaded',attempts});setUncertain(false);}
  }).catch(error=>{if(live&&!controller.signal.aborted){setData({phase:'error',attempts:[]});setMessage(assignmentMessage(error));}});
  return()=>{live=false;controller.abort();};
 },[learnerId,assignmentId,refresh]);
 const last=data.attempts[0];
 const canSubmit=data.phase==='loaded'&&(!last||last.decision==='retry_requested'&&last.attempt<5);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!canSubmit||busy.current||uncertain)return;
  busy.current=true;setSaving(true);setMessage('');
  try{
   await client.submit(learnerId,assignmentId,note.trim(),crypto.randomUUID());
   const attempts=await client.studentAttempts(learnerId,assignmentId);
   setData({phase:'loaded',attempts});setNote('');
   setMessage('تم إرسال المحاولة للشيخ وتأكيد حفظها على الخادم.');
  }catch(err){setMessage(assignmentMessage(err));setUncertain(true);}
  finally{busy.current=false;setSaving(false);}
 }
 return <section className={css.draftArea} aria-label="تسليم الواجب للشيخ">
  <div className={css.rowBetween}><strong>تسليم الواجب</strong>
   <button className={css.outlineButton} type="button" disabled={saving} onClick={()=>setRefresh(x=>x+1)}>
    تحديث الحالة</button></div>
  {data.phase==='loading'?<p role="status">جارٍ قراءة حالة التسليم...</p>:
   data.phase==='error'?<p role="alert">{message}</p>:
   <><p className={css.subtle}>{last?last.decision==='accepted'?'الشيخ اعتمد المحاولة.':
     last.decision==='retry_requested'?'الشيخ طلب إعادة التسليم.':
     'تم تسليم المحاولة، وهي بانتظار مراجعة الشيخ.':'لم تُرسل محاولة إلى الشيخ بعد.'}</p>
    {last&&<div className={css.rowBetween}>
      <span>المحاولة رقم {last.attempt} · {new Date(last.submittedAtMs).toLocaleString('ar-EG')}</span>
      {last.feedback&&<span>تعليق الشيخ: {last.feedback}</span>}
    </div>}
    {canSubmit&&<form onSubmit={submit} className={css.draftArea}>
      <label htmlFor={'submit-note-'+assignmentId}>ملاحظة اختيارية للشيخ (بدون صوت)</label>
      <textarea id={'submit-note-'+assignmentId} rows={2} maxLength={500} value={note}
       disabled={saving||uncertain} onChange={e=>setNote(e.target.value)}
       placeholder="ماذا راجعت؟ وما الآيات التي تحتاج إلى مساعدة؟"/>
      <button className={css.primaryButton} type="submit" disabled={saving||uncertain}>
       {saving?'جارٍ تسليم الواجب...':'إرسال المحاولة للشيخ'}</button>
    </form>}
   </>}
   {uncertain&&<p role="alert">حالة الإرسال غير مؤكدة. اضغط تحديث الحالة قبل أي محاولة أخرى.</p>}
   {message&&data.phase!=='error'&&<p role="status">{message}</p>}
   <p className={css.subtle}>هذا تسليم ملاحظات جاهزية فقط، وليس تسميعًا صوتيًا ولا درجة. التسجيل الخاص يظل على جهازك.</p>
 </section>;
}
