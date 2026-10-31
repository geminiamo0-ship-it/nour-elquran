'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {attendanceClient,AttendanceApiError,type TeacherAttendanceCase} from '../shared';
import type {TeacherCalendarRow,TeacherRosterRow} from './teacher-read-api';
import css from './TeacherReadOnly.module.css';

type View={status:'loading'|'loaded'|'error';cases:readonly TeacherAttendanceCase[]};
type Kind='student_no_show'|'connection_interruption';
export function TeacherConnectedAttendanceCases({learners,lessons}:{
 learners:readonly TeacherRosterRow[];lessons:readonly TeacherCalendarRow[];
}){
 const [view,setView]=useState<View>({status:'loading',cases:[]});
 const [refresh,setRefresh]=useState(0);
 const [lessonId,setLessonId]=useState('');
 const [kind,setKind]=useState<Kind>('student_no_show');
 const [reason,setReason]=useState('');
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [message,setMessage]=useState('');
 const operation=useRef<{key:string;id:string}|null>(null);
 const names=new Map(learners.map(item=>[item.id,item.name]));
 const eligible=lessons.filter(item=>item.status==='scheduled'||item.status==='live');
 const chosen=eligible.find(item=>item.id===lessonId)??eligible[0];
 const exists=chosen&&view.cases.some(item=>item.lessonId===chosen.id&&item.kind===kind);
 const canReport=!!chosen&&!exists&&
  (kind==='student_no_show'?chosen.status==='scheduled'&&Date.now()>=chosen.startsAtMs+900000:
   chosen.status==='live');
 useEffect(()=>{
  const abort=new AbortController();
  setView({status:'loading',cases:[]});setMessage('');
  void attendanceClient.teacherCases(abort.signal).then(cases=>{
   if(!abort.signal.aborted){setView({status:'loaded',cases});setUncertain(false);}
  }).catch(()=>{
   if(!abort.signal.aborted)setView({status:'error',cases:[]});
  });
  return()=>abort.abort();
 },[refresh]);
 async function report(){
  if(!chosen||!canReport||busy||uncertain||reason.trim().length<10||reason.trim().length>500||
   view.status!=='loaded')return;
  const key=chosen.id+':'+kind+':'+reason.trim();
  if(!operation.current||operation.current.key!==key)
   operation.current={key,id:crypto.randomUUID()};
  setBusy(true);setMessage('');
  try{
   await attendanceClient.report(chosen.id,kind,reason,operation.current.id);
   const cases=await attendanceClient.teacherCases();
   if(!cases.some(x=>x.lessonId===chosen.id&&x.kind===kind)){
    setUncertain(true);setMessage('تم قبول البلاغ لكن التحقق من السجل لم يكتمل؛ حدث الحالات.');
   }else{
    operation.current=null;setView({status:'loaded',cases});setReason('');
    setMessage('البلاغ المبدئي محفوظ. لا يُحتسب غياب نهائي ولا تُخصم حصة تلقائيًا.');
   }
  }catch(error){
   setUncertain(true);
   setMessage(error instanceof AttendanceApiError&&error.status===409?
    'لم يقبل الخادم البلاغ؛ قد يكون الطالب حاضرًا أو انتهت صلاحية رفعه. حدث الحالات قبل المحاولة مجددًا.':
    'حالة تسجيل البلاغ غير مؤكدة. حدّث السجل أولًا، ولا تكرر الإرسال بمعرّف جديد.');
  }finally{setBusy(false);}
 }
 return <section className={css.card} dir="rtl" aria-label="الحضور والبلاغات الفعلية">
  <div className={css.heading}><h1>الحضور والبلاغات</h1><span>سجل D1 موثّق</span></div>
  <p>عدم اتصال الطالب لا يساوي غيابًا نهائيًا. بلاغ التأخر متاح بعد 15 دقيقة فقط،
   وبعد التحقق من وجود الشيخ داخل غرفة الحصة؛ وتراجع الإدارة المسؤولية وأي تعويض.</p>
  <div className={css.actions}>
   <button type="button" disabled={busy} onClick={()=>{
    operation.current=null;setRefresh(x=>x+1);setUncertain(false);
   }}>تحديث السجل</button>
   <Link href="/teacher/schedule">جدول الحصص وغرف الانتظار</Link>
  </div>
  {view.status==='loading'?<p role="status">جارٍ تحميل الحالات الموثّقة…</p>:
   view.status==='error'?<p role="alert">خدمة الحضور غير متاحة؛ لا نعرض بلاغات تجريبية.</p>:
   <>
    <h2>بلاغ جديد</h2>
    {eligible.length?<div className={css.list}>
     <label>الحصة
      <select value={chosen?.id??''} disabled={busy||uncertain} onChange={e=>{
       setLessonId(e.target.value);setReason('');operation.current=null;setMessage('');
      }}>
       {eligible.map(l=><option key={l.id} value={l.id}>
        {names.get(l.learnerId)??l.learnerName??'طالب مُسند'} ·
        {new Date(l.startsAtMs).toLocaleString('ar-EG')}
       </option>)}
      </select>
     </label>
     <label>نوع البلاغ
      <select value={kind} disabled={busy||uncertain} onChange={e=>{
       setKind(e.target.value as Kind);operation.current=null;setReason('');
      }}>
       <option value="student_no_show">عدم حضور الطالب بعد 15 دقيقة</option>
       <option value="connection_interruption">انقطاع اتصال أثناء الحصة الجارية</option>
      </select>
     </label>
     <label>ما الذي حدث؟ (10–500 حرف)
      <textarea rows={3} maxLength={500} value={reason} disabled={busy||uncertain}
       onChange={e=>{setReason(e.target.value);operation.current=null;}} />
     </label>
     {chosen&&<p>
      <Link href={'/classroom/live?role=teacher&lessonId='+encodeURIComponent(chosen.id)}>
       دخول غرفة الحصة للتحقق من الحضور
      </Link>
     </p>}
     <button type="button" disabled={!canReport||busy||uncertain||reason.trim().length<10}
      onClick={()=>void report()}>{busy?'جارٍ تأكيد البلاغ…':'تسجيل بلاغ مبدئي'}</button>
     {!canReport&&<p role="status">لا يمكن تقديم هذا البلاغ في المرحلة الحالية للحصة،
      أو سبق تقديم بلاغ من نفس النوع.</p>}
    </div>:<p className={css.empty}>لا توجد حصص مجدولة أو جارية مؤهلة لرفع بلاغ.</p>}
    <h2>سجل البلاغات المُرسلة</h2>
    {view.cases.length?<div className={css.list}>{view.cases.map(item=>
     <article className={css.row} key={item.incidentId}>
      <div><strong>{names.get(item.learnerId)??'طالب مُسند'}</strong>
       <p>{item.kind==='student_no_show'?'بلاغ عدم حضور مبدئي':'بلاغ انقطاع الاتصال'}</p>
       <small>{new Date(item.reportedAtMs).toLocaleString('ar-EG')} · {item.reason}</small></div>
      <span>بانتظار قرار الإدارة</span>
     </article>)}</div>:<p className={css.empty}>لا توجد بلاغات موثقة من حساب الشيخ حتى الآن.</p>}
   </>}
  {message&&<p role={uncertain?'alert':'status'}>{message}</p>}
  <small>البلاغ لا يغيّر الحصة ولا أي رصيد اشتراك. لا تعرض واجهة الشيخ قرار الإدارة قبل توفير مصدر مصرح بذلك.</small>
 </section>;
}
