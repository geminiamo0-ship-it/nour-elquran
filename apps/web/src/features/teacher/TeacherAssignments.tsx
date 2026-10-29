'use client';
import {useState,type FormEvent} from 'react';
import {useTeacher} from './TeacherContext';
import {TASK_LABEL,validAssignment,type AssignmentKind} from './domain';
import {Empty,Panel,Pill,SectionHeading} from './TeacherUI';
import styles from './TeacherPortal.module.css';

const SURAHS=[
  {n:78,name:'النبأ',count:40},{n:87,name:'الأعلى',count:19},
  {n:75,name:'القيامة',count:40},{n:67,name:'الملك',count:30},
  {n:1,name:'الفاتحة',count:7},
] as const;
const statusLabel={assigned:'مطلوب', 'awaiting-review':'تسميع ينتظر التصحيح',completed:'مكتمل','retry-requested':'مطلوب إعادة تسميع'};
export function TeacherAssignments(){
  const {learners,assignments,createAssignment,reviewSubmission}=useTeacher();
  const [filter,setFilter]=useState<'all'|'awaiting-review'|'assigned'|'retry-requested'|'completed'>('all');
  const [kind,setKind]=useState<AssignmentKind>('memorization');
  const [surah,setSurah]=useState(78);
  const [fromAyah,setFromAyah]=useState('1');
  const [toAyah,setToAyah]=useState('10');
  const [dueDate,setDueDate]=useState('2026-10-31');
  const [learnerIds,setLearnerIds]=useState<string[]>([]);
  const [feedback,setFeedback]=useState<Record<string,string>>({});
  const [error,setError]=useState('');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const allowed=learners.filter(l=>l.primaryTeacher);
  const chosenSurah=SURAHS.find(s=>s.n===surah)!;
  const view=assignments.filter(t=>filter==='all'||t.status===filter);
  const selected=view.find(t=>t.id===selectedId)??view[0]??null;
  const draft={learnerIds,kind,surah,surahName:chosenSurah.name,fromAyah:Number(fromAyah),toAyah:Number(toAyah),dueDate};
  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!validAssignment(draft,allowed)||draft.toAyah>chosenSurah.count){
      setError('اختر طالبًا مصرحًا ونطاق آيات صحيحًا وموعدًا واضحًا.');return;
    }
    if(createAssignment(draft)){setError('');setLearnerIds([]);}
  }
  return <div>
    <SectionHeading eyebrow="الورد والتسميعات" title="الواجبات والتسميعات" description="واجب حفظ أو مراجعة أو تجويد مرتبط بآيات واضحة، ومحاولة تسميع مستقلة لكل طالب، مع تصحيح وطلب إعادة."/>
    <div className={styles.twoColumnsWide}>
      <Panel title="إعداد واجب جديد">
        <form className={styles.formStack} onSubmit={submit}>
          <fieldset className={styles.checkboxFieldset}><legend>اختر الطلاب المصرح بهم</legend>
            {allowed.length?allowed.map(l=><label key={l.id} className={styles.checkRow}><input type="checkbox"
              checked={learnerIds.includes(l.id)} onChange={e=>setLearnerIds(prev=>e.target.checked?[...prev,l.id]:prev.filter(x=>x!==l.id))}/>{l.name}</label>):
            <p className={styles.helpText}>لا يوجد طلاب مسندون. الشيخ البديل لا يغيّر خطة الطلاب الدائمة.</p>}
          </fieldset>
          <div className={styles.formGrid}>
            <label className={styles.fieldLabel}>نوع التدريب
              <select className={styles.input} value={kind} onChange={e=>setKind(e.target.value as AssignmentKind)}>
                {Object.entries(TASK_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select></label>
            <label className={styles.fieldLabel}>السورة
              <select className={styles.input} value={surah} onChange={e=>{setSurah(Number(e.target.value));setFromAyah('1');setToAyah('1');}}>
                {SURAHS.map(s=><option value={s.n} key={s.n}>{s.name}</option>)}
              </select></label>
            <label className={styles.fieldLabel}>من آية
              <input className={styles.input} type="number" min={1} max={chosenSurah.count} value={fromAyah} onChange={e=>setFromAyah(e.target.value)}/></label>
            <label className={styles.fieldLabel}>إلى آية
              <input className={styles.input} type="number" min={1} max={chosenSurah.count} value={toAyah} onChange={e=>setToAyah(e.target.value)}/></label>
            <label className={styles.fieldLabel}>الموعد النهائي
              <input className={styles.input} type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label>
          </div>
          {error&&<p role="alert" className={styles.errorText}>{error}</p>}
          <button type="submit" className={styles.primaryButton} disabled={!allowed.length}>إضافة واجب تجريبي</button>
          <p className={styles.helpText}>اختيارات السور هنا أمثلة موثقة النطاق للمعاينة. سيستخدم الـBackend فهرس جميع سور القرآن وحدود الآيات المعتمدة. لكل طالب تكليف مستقل حتى مع التوزيع الجماعي.</p>
        </form>
      </Panel>
      <Panel title="تسميعات تحتاج المراجعة" extra={<Pill tone="warning">{assignments.filter(a=>a.status==='awaiting-review').length} محاولة</Pill>}>
        {assignments.filter(a=>a.status==='awaiting-review').length?
          assignments.filter(a=>a.status==='awaiting-review').map(a=><div className={styles.detailRow} key={a.id}>
            <b>{learners.find(l=>l.id===a.learnerId)?.name}</b> · سورة {a.surahName} {a.fromAyah}–{a.toAyah}
            <p>محاولة رقم {a.attempt} · ملف الصوت خاص بالطالب</p>
            <button type="button" className={styles.secondaryButton} disabled title="لم يتم توصيل التخزين الخاص بالتسميعات بعد">▶ استماع بعد ربط التسجيل</button>
          </div>):<Empty title="لا توجد محاولات تحتاج مراجعة" description="تظهر هنا التسجيلات الحقيقية فقط بعد رفع صوت اختياري إلى R2 خاص ومصرح به."/>}
      </Panel>
    </div>
    <Panel title="سجل الواجبات والتسميعات">
      <div className={styles.filterBar}>{[
        {id:'all',label:'الكل'}, {id:'assigned',label:'قيد العمل'},
        {id:'awaiting-review',label:'تحتاج تصحيح'}, {id:'retry-requested',label:'إعادة تسميع'},
        {id:'completed',label:'مكتملة'},
      ].map(f=><button type="button" key={f.id} aria-pressed={filter===f.id}
        onClick={()=>{setFilter(f.id as typeof filter);setSelectedId(null);}}>{f.label}</button>)}</div>
      <div className={styles.twoColumns}>
        <div className={styles.rosterList}>{view.length?view.map(a=><button type="button" key={a.id}
          className={selected?.id===a.id?styles.rosterActive:styles.rosterItem} onClick={()=>setSelectedId(a.id)}>
          <span className={styles.rosterText}><b>{learners.find(l=>l.id===a.learnerId)?.name}</b><small>{TASK_LABEL[a.kind]} · سورة {a.surahName} {a.fromAyah}–{a.toAyah}</small></span>
          <Pill tone={a.status==='completed'?'good':a.status==='awaiting-review'?'warning':'neutral'}>{statusLabel[a.status]}</Pill>
        </button>):<Empty title="لا توجد تكليفات" description="يمكنك إعداد واجب مستقل لكل طالب."/>}</div>
        {selected&&<div className={styles.submissionBox}>
          <h3>متابعة الواجب</h3><p>تاريخ الاستحقاق: {selected.dueDate}</p>
          <p>المحاولة: {selected.attempt||'لم يُرسل'} · {statusLabel[selected.status]}</p>
          {selected.feedback&&<div className={styles.infoBar}>التصحيح السابق: {selected.feedback}</div>}
          {selected.status==='awaiting-review'&&<>
            <label className={styles.fieldLabel}>ملاحظاتك المرتبطة بالآيات
              <textarea className={styles.textarea} rows={3} maxLength={500}
                placeholder="مثلًا: إعادة تسميع الآية ٥ مع ضبط أحكام المد..."
                value={feedback[selected.id]??''} onChange={e=>setFeedback({...feedback,[selected.id]:e.target.value})}/></label>
            <div className={styles.actions}>
              <button type="button" className={styles.primaryButton}
                disabled={!(feedback[selected.id]??'').trim()}
                onClick={()=>reviewSubmission(selected.id,feedback[selected.id]??'',false)}>اعتماد التصحيح التجريبي</button>
              <button type="button" className={styles.secondaryButton}
                disabled={!(feedback[selected.id]??'').trim()}
                onClick={()=>reviewSubmission(selected.id,feedback[selected.id]??'',true)}>طلب إعادة تسميع</button>
            </div>
          </>}
          <p className={styles.helpText}>عند الربط الحقيقي تُحفظ كل محاولة نهائيًا ولا تُستبدل، وتظل ملفات التسجيل خاصة ولا تعرض روابط عامة.</p>
        </div>}
      </div>
    </Panel>
  </div>;
}
