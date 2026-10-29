'use client';
import {useState} from 'react';
import {useTeacher} from './TeacherContext';
import type {LessonReport} from './domain';
import {Empty,Panel,Pill,SectionHeading} from './TeacherUI';
import styles from './TeacherPortal.module.css';

const scores: readonly {key:'hifz'|'recitation'|'tajweed';label:string}[]=[
  {key:'hifz',label:'الحفظ'},{key:'recitation',label:'التلاوة'},{key:'tajweed',label:'التجويد'},
];
function ReportPreview({report,learnerName,onClose}:{report:LessonReport;learnerName:string;onClose:()=>void}){
  return <div className={styles.modalOverlay} role="presentation" onClick={onClose}>
    <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="report-preview-title"
      onClick={e=>e.stopPropagation()}>
      <div className={styles.panelTitle}><h2 id="report-preview-title">معاينة تقرير الطالب · غير منشور</h2>
        <button type="button" className={styles.secondaryButton} onClick={onClose}>إغلاق</button></div>
      <p className={styles.eyebrow}>{learnerName} · نسخة {report.revision}</p>
      <p><strong>النطاق المنجز:</strong> {report.scope||'لم يُحدد بعد'}</p>
      <div className={styles.gradeRow}>{scores.map(g=><div key={g.key}><span>{g.label}</span><strong>{report[g.key]===null?'لم يُقيّم':report[g.key]+'/10'}</strong></div>)}</div>
      <p><b>نقاط القوة:</b> {report.strengths||'—'}</p><p><b>مواضع التصحيح:</b> {report.corrections||'—'}</p>
      <p><b>خطة المراجعة القادمة:</b> {report.nextPlan||'—'}</p>
      <div className={styles.warningNote}>هذه معاينة لواجهة التقرير، وليست نشرًا فعليًا أو تصدير PDF. صفحات المصحف المعلّمة ستُربط بالإصدار المعتمد من الخادم.</div>
    </section>
  </div>;
}
export function TeacherReports(){
  const {reports,learners,updateReport,publishReport,reopenReport}=useTeacher();
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [filter,setFilter]=useState<'all'|'draft'|'published'>('all');
  const [showPreview,setShowPreview]=useState(false);
  const filtered=reports.filter(r=>filter==='all'||r.status===filter);
  const selected=filtered.find(r=>r.id===selectedId)??filtered[0]??null;
  const edit=(key:keyof Pick<LessonReport,'scope'|'strengths'|'corrections'|'nextPlan'>,value:string)=>{
    if(selected)updateReport(selected.id,{[key]:value});
  };
  return <div>
    <SectionHeading eyebrow="التوثيق والتقييم" title="تقارير الحصص" description="ثلاث درجات مستقلة من ١٠، مسودة خاصة، معاينة للطالب، ثم اعتماد صريح بإصدار محفوظ."/>
    <div className={styles.infoBar}>لا تُنشر المسودات ولا يتحول التقييم الناقص إلى صفر. بعد التعديل على تقرير منشور يبقى الإصدار المعتمد السابق ظاهرًا للطالب حتى اعتماد الجديد.</div>
    <div className={styles.filterBar}>{[
      {id:'all',label:'كل التقارير'},{id:'draft',label:'في انتظار الاعتماد'},{id:'published',label:'معتمدة'},
    ].map(f=><button type="button" key={f.id} aria-pressed={filter===f.id}
      onClick={()=>{setFilter(f.id as typeof filter);setSelectedId(null);}}>{f.label}</button>)}</div>
    <div className={styles.twoColumnsWide}>
      <Panel title="سجل التقارير" extra={<Pill tone="warning">{reports.filter(r=>r.status==='draft').length} مسودة</Pill>}>
        {filtered.length?filtered.map(r=><button type="button" key={r.id}
          onClick={()=>setSelectedId(r.id)} aria-pressed={r.id===selected?.id}
          className={r.id===selected?.id?styles.rosterActive:styles.rosterItem}>
          <span className={styles.rosterText}><b>{learners.find(l=>l.id===r.learnerId)?.name??'طالب'}</b>
            <small>{r.scope} · نسخة {r.revision}</small></span>
          <Pill tone={r.status==='published'?'good':'warning'}>{r.status==='published'?'معتمد':'مسودة'}</Pill>
        </button>):<Empty title="لا توجد تقارير" description="عند انتهاء فصل بضغط الشيخ يُدرج التقرير هنا بصفته مسودة، دون نشر تلقائي."/>}
      </Panel>
      <Panel title={selected?'تقرير '+(learners.find(l=>l.id===selected.learnerId)?.name??'الطالب'):'تفاصيل التقرير'}>
        {selected?<div className={styles.formStack}>
          <div className={styles.rowBetween}><Pill tone={selected.status==='draft'?'warning':'good'}>{selected.status==='draft'?'مسودة خاصة':'منشور'}</Pill>
            <span className={styles.helpText}>الإصدار {selected.revision} · المنشور {selected.publishedRevision??'لا يوجد'}</span></div>
          <label className={styles.fieldLabel} htmlFor="report-scope">الآيات المنجزة خلال الحصة</label>
          <input id="report-scope" className={styles.input} value={selected.scope} maxLength={700}
            disabled={selected.status==='published'} onChange={e=>edit('scope',e.target.value)}/>
          <div className={styles.gradeRow}>
            {scores.map(g=><label key={g.key} className={styles.scoreSelect}>{g.label}
              <select aria-label={'درجة '+g.label} value={selected[g.key]??''} disabled={selected.status==='published'}
                onChange={e=>updateReport(selected.id,{[g.key]:e.target.value===''?null:Number(e.target.value)})}>
                <option value="">لم يُقيّم</option>
                {Array.from({length:11},(_,i)=><option key={i} value={i}>{i} / 10</option>)}
              </select>
            </label>)}
          </div>
          {([
            ['strengths','نقاط القوة'],['corrections','الأخطاء ومواضع المراجعة'],['nextPlan','خطة الورد القادم'],
          ] as const).map(([key,label])=><label className={styles.fieldLabel} key={key}>{label}
            <textarea rows={3} className={styles.textarea} value={selected[key]} maxLength={1000}
              disabled={selected.status==='published'} onChange={e=>edit(key,e.target.value)}/>
          </label>)}
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={()=>setShowPreview(true)}>معاينة الطالب</button>
            {selected.status==='draft'?<button type="button" className={styles.primaryButton}
              onClick={()=>publishReport(selected.id)} disabled={!selected.scope.trim()}>اعتماد ونشر تجريبي</button>:
            <button type="button" className={styles.secondaryButton} onClick={()=>reopenReport(selected.id)}>فتح مسودة تعديل جديدة</button>}
          </div>
          <p className={styles.helpText}>ملاحظة: حالات الاعتماد هنا في ذاكرة المعاينة فقط. الـBackend هو المسؤول عن الإصدار المنشور السابق، وقائمة التعديلات، وسجل المؤلف والموافقة.</p>
        </div>:<Empty title="لا يوجد تقرير محدد" description="اختَر تقريرًا لعرض درجات الحفظ والتلاوة والتجويد منفصلة."/>}
      </Panel>
    </div>
    {showPreview&&selected&&<ReportPreview report={selected} learnerName={learners.find(l=>l.id===selected.learnerId)?.name??'الطالب'}
      onClose={()=>setShowPreview(false)}/>}
  </div>;
}
