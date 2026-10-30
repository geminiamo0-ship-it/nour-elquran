'use client';
import {Fragment,useEffect,useState} from 'react';
import {lessonReportsClient,reportErrorMessage,type StudentReport} from '../../shared';
import styles from '../StudentPortal.module.css';
import table from './ProgressTable.module.css';
const score=(v:number|null)=>v===null?'لم يُقيَّم':v+' / 10';
const when=(ms:number)=>new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',
 dateStyle:'medium',timeStyle:'short'}).format(new Date(ms));
export function ConnectedProgressReports({learnerId}:{learnerId:string}){
 const [rows,setRows]=useState<readonly StudentReport[]>([]);
 const [status,setStatus]=useState<'loading'|'loaded'|'error'>('loading');
 const [retry,setRetry]=useState(0);
 const [expanded,setExpanded]=useState<string|null>(null);
 useEffect(()=>{
  let live=true;const abort=new AbortController();setStatus('loading');
  setRows([]);setExpanded(null);
  void lessonReportsClient.student(learnerId,abort.signal).then(data=>{
   if(live&&!abort.signal.aborted){setRows(data);setStatus('loaded');}
  }).catch(()=>{
   if(live&&!abort.signal.aborted)setStatus('error');
  });
  return()=>{live=false;abort.abort();};
 },[learnerId,retry]);
 return <div className={styles.workspace}>
  <section className={styles.panel} aria-labelledby="verified-report-heading">
   <div className={styles.panelHead}><div>
    <p className={styles.eyebrow}>التقارير المنشورة من الشيخ فقط</p>
    <h2 id="verified-report-heading">السجل الأكاديمي</h2>
   </div><span className={styles.statusNeutral}>
    {status==='loaded'?rows.length+' تقرير معتمد':'بيانات الخادم'}
   </span></div>
   <p className={styles.panelIntro}>آخر إصدار معتمد لكل حصة، دون مسودات الشيخ.
    التقييمات الثلاثة مستقلة، والدرجة غير المتوفرة لا تُحسب صفرًا.</p>
   {status==='loading'?<p role="status">جارٍ تحميل التقارير المعتمدة...</p>:
    status==='error'?<div role="alert">
     <p>{reportErrorMessage(null)}</p>
     <button type="button" onClick={()=>setRetry(n=>n+1)}>إعادة التحميل</button>
    </div>:
    !rows.length?<div className={styles.emptyBox}>
     لم ينشر الشيخ أي تقرير معتمد لهذا الطالب بعد.
    </div>:<div className={table.scroll} tabIndex={0} role="region" aria-label="التقارير الحقيقية">
     <table className={table.table}><thead><tr>
      <th scope="col">الحصة / التاريخ</th><th scope="col">الحفظ</th>
      <th scope="col">التلاوة</th><th scope="col">التجويد</th><th scope="col">التقرير</th>
     </tr></thead><tbody>{rows.map(report=>{
      const open=expanded===report.lessonId;
      const detailsId='connected-report-'+report.lessonId;
      return <Fragment key={report.lessonId}>
       <tr>
        <th scope="row">{when(report.publishedAtMs)} <small>إصدار {report.revision}</small></th>
        <td>{score(report.memorization)}</td>
        <td>{score(report.recitation)}</td>
        <td>{score(report.tajweed)}</td>
        <td><button type="button" className={table.expand} aria-expanded={open}
         aria-controls={detailsId} onClick={()=>setExpanded(open?null:report.lessonId)}>
         {open?'إخفاء':'عرض التقرير'}</button></td>
       </tr>
       <tr hidden={!open}><td colSpan={5} id={detailsId}>
        <div className={table.details}>
         <p><strong>الآيات المنجزة:</strong> {report.scope}</p>
         <p><strong>نقاط القوة:</strong> {report.strengths||'—'}</p>
         <p><strong>مواضع التصحيح:</strong> {report.corrections||'—'}</p>
         <p><strong>خطة المراجعة:</strong> {report.nextPlan||'—'}</p>
         <p className={table.unavailable}>أرشيف المصحف المشروح قيد الربط بالحصة الحقيقية.</p>
        </div>
       </td></tr>
      </Fragment>;
     })}</tbody></table>
    </div>}
  </section>
  <section className={styles.panel}><h2>الحضور والتقدم</h2>
   <p>سيظهر سجل الحضور المعتمد بعد ربط أحداث الحصص. لا تُعرض بيانات حضور تجريبية للحساب الحقيقي.</p>
  </section>
 </div>;
}
