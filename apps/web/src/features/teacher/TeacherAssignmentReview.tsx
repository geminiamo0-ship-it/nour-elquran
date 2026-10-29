'use client';
import {useEffect,useRef,useState} from 'react';
import {assignmentAttemptClient,assignmentMessage,type AssignmentAttempt} from '../shared';
import css from './TeacherReadOnly.module.css';
const client=assignmentAttemptClient();
type State={status:'loading'|'loaded'|'error';attempts:readonly AssignmentAttempt[]};
export function TeacherAssignmentReview({learnerId,assignmentId}:{learnerId:string;assignmentId:string}){
 const [state,setState]=useState<State>({status:'loading',attempts:[]});
 const [feedback,setFeedback]=useState(''),[message,setMessage]=useState('');
 const [saving,setSaving]=useState(false),[uncertain,setUncertain]=useState(false),[refresh,setRefresh]=useState(0);
 const busy=useRef(false);
 useEffect(()=>{
  let live=true;const ctrl=new AbortController();
  setState({status:'loading',attempts:[]});setMessage('');
  void client.teacherAttempts(learnerId,assignmentId,ctrl.signal)
   .then(attempts=>{if(live&&!ctrl.signal.aborted){setState({status:'loaded',attempts});setUncertain(false);}})
   .catch(e=>{if(live&&!ctrl.signal.aborted){setState({status:'error',attempts:[]});setMessage(assignmentMessage(e));}});
  return()=>{live=false;ctrl.abort();};
 },[learnerId,assignmentId,refresh]);
 const latest=state.attempts[0],canReview=!!latest&&latest.decision===null;
 async function review(decision:'accepted'|'retry_requested'){
  if(!latest||!canReview||!feedback.trim()||busy.current||uncertain)return;
  busy.current=true;setSaving(true);setMessage('');
  try{
   await client.review(learnerId,assignmentId,latest.id,decision,feedback.trim(),crypto.randomUUID());
   const attempts=await client.teacherAttempts(learnerId,assignmentId);
   setState({status:'loaded',attempts});setFeedback('');
   setMessage(decision==='accepted'?'تم اعتماد المحاولة وحفظ رد الشيخ.':'تم طلب إعادة التسليم، وأصبح بإمكان الطالب المحاولة مجددًا.');
  }catch(e){setMessage(assignmentMessage(e));setUncertain(true);}
  finally{busy.current=false;setSaving(false);}
 }
 return <section className={css.card} aria-label="مراجعة المحاولات">
  <div className={css.heading}><h2>تسليم الطالب ومراجعته</h2>
   <button type="button" onClick={()=>setRefresh(x=>x+1)} disabled={saving}>تحديث</button></div>
  {state.status==='loading'?<p role="status">جارٍ قراءة محاولات الطالب...</p>:
   state.status==='error'?<p role="alert">{message}</p>:
   !state.attempts.length?<p className={css.empty}>الطالب لم يرسل محاولات مكتوبة لهذا الواجب.</p>:
   <div className={css.list}>{state.attempts.map(attempt=><article key={attempt.id} className={css.row}>
    <div><strong>المحاولة {attempt.attempt}</strong>
     <small>{new Date(attempt.submittedAtMs).toLocaleString('ar-EG')}</small></div>
    <p>{attempt.note||'بدون ملاحظة مكتوبة'}</p>
    <p>{attempt.decision==='accepted'?'معتمدة':
      attempt.decision==='retry_requested'?'تحتاج إعادة':'بانتظار مراجعتك'}</p>
    {attempt.feedback&&<p>رد الشيخ: {attempt.feedback}</p>}
   </article>)}</div>}
  {canReview&&<div style={{display:'grid',gap:10}}>
   <label>رد الشيخ على المحاولة<textarea rows={3} maxLength={1000} value={feedback}
    disabled={saving||uncertain} onChange={e=>setFeedback(e.target.value)}
    placeholder="ملاحظة محددة تساعد الطالب في الحفظ أو المراجعة"/></label>
   <div className={css.actions}>
    <button type="button" disabled={saving||uncertain||!feedback.trim()} onClick={()=>void review('accepted')}>
      اعتماد المحاولة</button>
    <button type="button" disabled={saving||uncertain||!feedback.trim()} onClick={()=>void review('retry_requested')}>
      طلب إعادة التسليم</button>
   </div>
  </div>}
  {uncertain&&<p role="alert">القرار غير مؤكد. حدّث الحالة قبل إعطاء قرار جديد، لمنع تكرار التصحيح.</p>}
  {message&&state.status!=='error'&&<p role="status">{message}</p>}
  <p>لا يوجد تقييم رقمي أو ملف صوتي مرتبط بهذه المحاولة حتى الآن.</p>
 </section>;
}
