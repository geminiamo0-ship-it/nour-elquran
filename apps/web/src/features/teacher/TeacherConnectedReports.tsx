'use client';
import {useEffect,useRef,useState} from 'react';
import type {TeacherCalendarRow,TeacherRosterRow} from './teacher-read-api';
import {blankReport,lessonReportsClient,reportErrorMessage,
 type ReportContent,type TeacherReport} from '../shared/lesson-report-client';
import css from './TeacherReadOnly.module.css';

const scores=[
 {key:'memorization',label:'الحفظ'},
 {key:'recitation',label:'التلاوة'},
 {key:'tajweed',label:'التجويد'},
] as const;
function time(at:number){return new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',
 dateStyle:'medium',timeStyle:'short'}).format(new Date(at));}
export function TeacherConnectedReports({learners,lessons}:{
 learners:readonly TeacherRosterRow[];lessons:readonly TeacherCalendarRow[];
}){
 const completed=lessons.filter(l=>l.status==='completed').sort((a,b)=>b.startsAtMs-a.startsAtMs);
 const [chosen,setChosen]=useState('');
 const selected=completed.find(l=>l.id===chosen)??completed[0];
 const lessonId=selected?.id??'';
 const [loading,setLoading]=useState(true);
 const [server,setServer]=useState<TeacherReport|null>(null);
 const [draft,setDraft]=useState<ReportContent>(blankReport);
 const [editing,setEditing]=useState(false);
 const [dirty,setDirty]=useState(false);
 const [busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false);
 const [message,setMessage]=useState('');
 const [retry,setRetry]=useState(0);
 const inFlight=useRef(false);
 useEffect(()=>{
  let alive=true;const abort=new AbortController();
  setLoading(true);setMessage('');setUncertain(false);setEditing(false);setDirty(false);
  setServer(null);setDraft(blankReport());
  if(!lessonId){setLoading(false);return()=>abort.abort();}
  void lessonReportsClient.teacher(lessonId,abort.signal).then(report=>{
   if(!alive||abort.signal.aborted)return;
   setServer(report);setDraft(report?pick(report):blankReport());
   setLoading(false);
  }).catch(err=>{
   if(!alive||abort.signal.aborted)return;
   setMessage(reportErrorMessage(err));setLoading(false);setUncertain(true);
  });
  return()=>{alive=false;abort.abort();};
 },[lessonId,retry]);
 function pick(v:TeacherReport):ReportContent{
  return {scope:v.scope,strengths:v.strengths,corrections:v.corrections,nextPlan:v.nextPlan,
   memorization:v.memorization,recitation:v.recitation,tajweed:v.tajweed};
 }
 function change<K extends keyof ReportContent>(key:K,value:ReportContent[K]){
  setDraft(prev=>({...prev,[key]:value}));setDirty(true);setMessage('');
 }
 const isPublished=server?.status==='published'&&!editing;
 const canEdit=!loading&&!busy&&!uncertain&&!isPublished;
 async function action(kind:'save'|'publish'){
  if(!lessonId||loading||uncertain||inFlight.current)return;
  if(kind==='publish'&&(dirty||server?.status!=='draft'||!server.scope.trim()))return;
  if(kind==='save'&&!dirty)return;
  inFlight.current=true;setBusy(true);setMessage('');
  try {
   const version=server?.revision??0;
   if(kind==='save')await lessonReportsClient.save(lessonId,version,draft,crypto.randomUUID());
   else await lessonReportsClient.publish(lessonId,version,crypto.randomUUID());
   const updated=await lessonReportsClient.teacher(lessonId);
   setServer(updated);setDraft(updated?pick(updated):blankReport());
   setDirty(false);setEditing(false);
   setMessage(kind==='save'?'تم تأكيد حفظ المسودة على الخادم.':'تم نشر التقرير للطالب بعد اعتماد الشيخ.');
  }catch(error){
   setUncertain(true);setMessage(reportErrorMessage(error));
  }finally{inFlight.current=false;setBusy(false);}
 }
 if(!completed.length)return <section className={css.card}>
  <h1>تقارير الحصص</h1><p>لا توجد حصص مكتملة ضمن جدولك المصرح به.
   لا يمكن إنشاء تقرير رسمي قبل إغلاق الحصة وتسجيل حدث نهايتها على الخادم.</p>
 </section>;
 return <section className={css.card} aria-label="تقارير الحصص الفعلية">
  <div className={css.heading}><h1>تقارير الحصص</h1><span>مسودات واعتماد بإصدارات</span></div>
  <p>يمكنك إعداد تقرير الحصة التي درّستها فقط. المسودة لا تظهر للطالب.
   بعد النشر يظل آخر إصدار معتمد ظاهرًا حتى تعتمد نسخة جديدة.</p>
  <label>الحصة المكتملة
   <select value={lessonId} disabled={busy} onChange={e=>setChosen(e.target.value)}>
    {completed.map(l=><option key={l.id} value={l.id}>
     {learners.find(t=>t.id===l.learnerId)?.name??l.learnerName??'الطالب'} · {time(l.startsAtMs)}
    </option>)}
   </select>
  </label>
  {loading?<p role="status">جارٍ تحميل حالة التقرير وصلاحيات الحصة...</p>:
   uncertain&&server===null?<div role="alert"><p>{message}</p>
    <button type="button" onClick={()=>setRetry(n=>n+1)}>إعادة التحقق</button></div>:
   <div style={{display:'grid',gap:12}}>
    <p role="status">{server
     ?server.status==='published'?'إصدار معتمد '+server.revision:'مسودة خاصة · إصدار '+server.revision
     :'لم تُنشأ مسودة بعد'}
     {server?.publishedRevision?' · آخر منشور '+server.publishedRevision:''}
    </p>
    <label>الآيات والنطاق المنجز
     <textarea rows={2} maxLength={700} value={draft.scope} disabled={!canEdit}
      onChange={e=>change('scope',e.target.value)}/>
    </label>
    <div className={css.actions}>
     {scores.map(s=><label key={s.key}>{s.label}
      <select value={draft[s.key]??''} disabled={!canEdit}
       onChange={e=>change(s.key,e.target.value===''?null:Number(e.target.value))}>
       <option value="">لم يُقيَّم</option>
       {Array.from({length:11},(_,i)=><option key={i} value={i}>{i} / 10</option>)}
      </select>
     </label>)}
    </div>
    {([{key:'strengths',label:'نقاط القوة'},
       {key:'corrections',label:'الأخطاء ومواضع التصحيح'},
       {key:'nextPlan',label:'الورد وخطة المراجعة القادمة'}] as const)
       .map(field=><label key={field.key}>{field.label}
        <textarea rows={3} maxLength={1000} value={draft[field.key]} disabled={!canEdit}
         onChange={e=>change(field.key,e.target.value)}/>
       </label>)}
    <div className={css.actions}>
     {isPublished?<button type="button" disabled={busy||uncertain}
       onClick={()=>setEditing(true)}>إنشاء مسودة تعديل</button>:<>
      <button type="button" disabled={busy||uncertain||!dirty}
       onClick={()=>void action('save')}>{busy?'جارٍ الحفظ…':'حفظ المسودة'}</button>
      <button type="button" disabled={busy||uncertain||dirty||
       server?.status!=='draft'||!server.scope.trim()}
       onClick={()=>void action('publish')}>اعتماد ونشر التقرير</button>
     </>}
     <button type="button" disabled={busy} onClick={()=>setRetry(n=>n+1)}>
      تحديث من الخادم
     </button>
    </div>
    {dirty&&<p>تعديلات غير محفوظة. احفظ المسودة أولًا قبل النشر.</p>}
    {uncertain&&<p role="alert">نتيجة العملية غير مؤكدة. تحديث التقرير واجب قبل إعادة الإرسال.</p>}
    {message&&!uncertain&&<p role="status">{message}</p>}
   </div>}
 </section>;
}
