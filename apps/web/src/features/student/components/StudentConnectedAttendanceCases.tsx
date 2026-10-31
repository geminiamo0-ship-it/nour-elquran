'use client';
import {useEffect,useRef,useState} from 'react';
import {attendanceClient,type AttendanceCase} from '../../shared';
import styles from '../StudentPortal.module.css';

const SEVEN_DAYS=7*24*60*60*1000;
type State={status:'loading'|'loaded'|'error';items:readonly AttendanceCase[]};
/** The guardian's exact selected child from Better Auth; no demo attendance.
 * A teacher's preliminary report cannot become a charged or final absence.
 */
export function StudentConnectedAttendanceCases({learnerId}:{learnerId:string}){
 const [state,setState]=useState<State>({status:'loading',items:[]});
 const [refresh,setRefresh]=useState(0);
 const [selected,setSelected]=useState<string|null>(null);
 const [reason,setReason]=useState('');
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [message,setMessage]=useState('');
 const operation=useRef<{key:string;id:string}|null>(null);
 useEffect(()=>{
  const controller=new AbortController();
  setState({status:'loading',items:[]});setSelected(null);setReason('');
  setMessage('');setUncertain(false);operation.current=null;
  void attendanceClient.ownerCases(learnerId,controller.signal).then(items=>{
   if(!controller.signal.aborted)setState({status:'loaded',items});
  }).catch(()=>{
   if(!controller.signal.aborted)setState({status:'error',items:[]});
  });
  return()=>controller.abort();
 },[learnerId,refresh]);
 const selectedCase=state.items.find(item=>item.incidentId===selected);
 const canAppeal=(item:AttendanceCase)=>item.kind==='student_no_show'&&item.appealId===null&&
   Date.now()>=item.reportedAtMs&&Date.now()<=item.reportedAtMs+SEVEN_DAYS;
 async function sendAppeal(){
  const item=selectedCase;
  if(!item||!canAppeal(item)||busy||uncertain||reason.trim().length<10||
   reason.trim().length>1000)return;
  const key=learnerId+':'+item.incidentId+':'+reason.trim();
  if(!operation.current||operation.current.key!==key)
   operation.current={key,id:crypto.randomUUID()};
  setBusy(true);setMessage('');
  try{
   const id=await attendanceClient.appeal(learnerId,item.incidentId,reason,operation.current.id);
   const items=await attendanceClient.ownerCases(learnerId);
   if(!items.some(row=>row.incidentId===item.incidentId&&row.appealId===id)){
    setUncertain(true);
    setMessage('وصل تأكيد للطلب، لكن التحقق من السجل لم يكتمل؛ حدّث الحالة قبل الإرسال مرة أخرى.');
   }else{
    setState({status:'loaded',items});setSelected(null);setReason('');
    operation.current=null;
    setMessage('تم حفظ الاعتراض بانتظار قرار الإدارة. لا يترتب عليه أي خصم تلقائي.');
   }
  }catch{
   setUncertain(true);
   setMessage('لم نستطع تأكيد وصول الاعتراض. حدّث الحالات للتحقق، ولا تنشئ طلبًا جديدًا.');
  }finally{setBusy(false);}
 }
 return <section className={styles.panel} dir="rtl" aria-label="سجل الحضور والاعتراضات الموثقة">
  <div className={styles.panelHead}><div>
   <span className={styles.eyebrow}>الحضور والمتابعة</span>
   <h2>بلاغات الحصص والاعتراضات</h2></div>
   <button type="button" className={styles.outlineButton} disabled={busy}
    onClick={()=>{operation.current=null;setRefresh(v=>v+1);}}>تحديث من الخادم</button>
  </div>
  <p>البلاغات هنا مبدئية فقط، وليست دليل غياب نهائيًا أو خصمًا من الاشتراك.
   يمكنك طلب مراجعة بلاغ عدم الحضور خلال سبعة أيام من تسجيله.</p>
  {state.status==='loading'?<p role="status">جارٍ تحميل سجل الطالب الموثق…</p>:
   state.status==='error'?<p role="alert">تعذر قراءة حالات الحضور لهذا الطالب؛ لا نعرض أمثلة تجريبية.</p>:
   state.items.length?<div className={styles.stack}>{state.items.map(item=>
    <article className={styles.lessonRow} key={item.incidentId}>
     <div className={styles.lessonInfo}>
      <strong>{item.kind==='student_no_show'?'بلاغ عدم حضور مبدئي':'بلاغ انقطاع اتصال'}</strong>
      <small>{new Date(item.reportedAtMs).toLocaleString('ar-EG')}</small>
      <span>{item.reason}</span>
      {item.appealId&&<p role="status">
       {item.decision===null?'طلب المراجعة قيد نظر الإدارة':
        item.decision==='accepted'?'قبلت الإدارة الاعتراض':'رفضت الإدارة الاعتراض'}
       {item.decisionReason&&' — '+item.decisionReason}
      </p>}
     </div>
     {canAppeal(item)?<button type="button" className={styles.outlineButton}
      disabled={busy||uncertain} onClick={()=>{
       setSelected(item.incidentId);setReason('');setMessage('');operation.current=null;
      }}>طلب مراجعة</button>:
      item.kind==='student_no_show'&&item.appealId===null?
       <small>انتهت مهلة الاعتراض المعتادة؛ تواصل مع الإدارة للاستثناء.</small>:null}
    </article>)}</div>:<p className={styles.emptyBox}>
    لا توجد بلاغات فعلية مرتبطة بهذا الطالب.</p>}
  {selectedCase&&canAppeal(selectedCase)&&<div className={styles.stack}>
   <h3>إرسال طلب مراجعة بلاغ</h3>
   <p>المهلة حتى {new Date(selectedCase.reportedAtMs+SEVEN_DAYS).toLocaleString('ar-EG')}.</p>
   <label htmlFor="attendance-appeal-reason-live">سبب الاعتراض (10–1000 حرف)</label>
   <textarea id="attendance-appeal-reason-live" className={styles.textArea} rows={3} maxLength={1000}
    disabled={busy||uncertain} value={reason}
    onChange={e=>{setReason(e.target.value);operation.current=null;}} />
   <div className={styles.actionRow}>
    <button className={styles.actionButton} type="button"
     disabled={busy||uncertain||reason.trim().length<10} onClick={()=>void sendAppeal()}>
     {busy?'جارٍ تأكيد الاعتراض…':'إرسال طلب المراجعة'}</button>
    <button className={styles.outlineButton} type="button" disabled={busy}
     onClick={()=>{setSelected(null);setReason('');operation.current=null;}}>إلغاء</button>
   </div>
   <small>إرسال مستندات أو صور إثبات غير متاح قبل تفعيل التخزين الخاص الآمن.</small>
  </div>}
  {message&&<p role={uncertain?'alert':'status'}>{message}</p>}
 </section>;
}
