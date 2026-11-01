'use client';
import {useMemo,useState} from 'react';
import {useStudent} from '../StudentContext';
import {ConnectedProgressReports} from './ConnectedProgressReports';
import {latestPublishedReports,REPORTS_PAGE_SIZE,nextReportCount} from '../reportHistory';
import type {Grade} from '../domain';
import css from './LessonsPremium.module.css';

function Score({value}:{value:Grade}){
 return <>{value===null?'لم يُقيّم':value+' / 10'}</>;
}
export function ProgressWorkspace(){
 const {selected}=useStudent();
 const reports=useMemo(()=>latestPublishedReports(selected.reports,selected.profile.id),
  [selected.reports,selected.profile.id]);
 const [count,setCount]=useState(REPORTS_PAGE_SIZE);
 const [expanded,setExpanded]=useState<string|null>(null);
 if(!selected.profile.demo)return <ConnectedProgressReports learnerId={selected.profile.id}/>;
 return <section className={css.panel} aria-label="التقارير المنشورة">
  <div className={css.panelHead}><h2>تقارير الشيخ</h2>
   {reports.length>0&&<small>{reports.length} تقرير توضيحي</small>}
  </div>
  {reports.length===0?<p className={css.reportEmpty}>
   لا توجد تقارير منشورة لهذا الطالب حتى الآن.
  </p>:<div className={css.reportList}>
   {reports.slice(0,count).map(report=><article className={css.reportCard} key={report.id}>
    <div className={css.reportHead}><div><strong>{report.dateLabel}</strong>
     <small>{report.teacher} · تقرير توضيحي</small></div>
     <button type="button" className={css.detailsButton}
      aria-expanded={expanded===report.id}
      onClick={()=>setExpanded(expanded===report.id?null:report.id)}>
      {expanded===report.id?'إخفاء التفاصيل':'التفاصيل'}</button></div>
    <div className={css.reportGrades}>
     <div className={css.grade}><span>الحفظ</span><strong><Score value={report.memorization}/></strong></div>
     <div className={css.grade}><span>التلاوة</span><strong><Score value={report.recitation}/></strong></div>
     <div className={css.grade}><span>التجويد</span><strong><Score value={report.tajweed}/></strong></div>
    </div>
    {expanded===report.id&&<div className={css.detailText}>
     <p>{report.summary}</p>
     <p>آيات الحفظ المثبتة: {report.memorizedAyat??'غير مذكور'} · المراجعة: {report.reviewedAyat??'غير مذكور'}</p>
    </div>}
   </article>)}
   {count<reports.length&&<button type="button" className={css.more}
    onClick={()=>setCount(n=>nextReportCount(n,reports.length))}>عرض المزيد</button>}
  </div>}
 </section>;
}
