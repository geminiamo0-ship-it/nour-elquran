'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useStudent} from '../StudentContext';
import {nextBookedLesson,validAssignmentRange,VOLUNTARY_SAMPLES} from '../quranAssignment';
import {TrainingQuranSession} from './TrainingQuranSession';
import {StudentPublishedAssignments} from './StudentPublishedAssignments';
import {StudentConnectedPreparation} from './StudentConnectedPreparation';
import css from './TrainingWorkspace.module.css';

type Tab='homework'|'practice'|'prepare';
const tabs=[
 {id:'homework',label:'واجباتي'},
 {id:'practice',label:'الحفظ والمراجعة'},
 {id:'prepare',label:'الاستعداد للحصة'},
] as const;

export function TrainingWorkspace(){
 const {selected,finished,toggleTask,taskDrafts,updateTaskDraft,preparedTasks,markTaskPrepared}=useStudent();
 const upcoming=nextBookedLesson(selected.lessons);
 // A signed learner's data is not assumed absent while private APIs are loading.
 const [tab,setTab]=useState<Tab>(()=>
   !selected.profile.demo||selected.tasks.length?'homework':
   upcoming&&upcoming.dayOffset<=1?'prepare':'practice');
 const [openTask,setOpenTask]=useState<string|null>(null);
 const [openNote,setOpenNote]=useState<string|null>(null);
 const [openPractice,setOpenPractice]=useState<number|null>(null);
 const [notice,setNotice]=useState('');
 const demo=selected.profile.demo;
 const pending=selected.tasks.filter(task=>!finished.includes(task.id)).length;
 function changeTab(next:Tab){
  setTab(next);setOpenTask(null);setOpenPractice(null);setNotice('');
 }
 return <div className={css.workspace} aria-label="تدريباتي">
  <header className={css.intro}>
   <div><h1>تدريباتي</h1>
    <p>واجبات الشيخ، الحفظ والمراجعة، والاستعداد للحصة.</p>
   </div>
   {demo&&pending>0&&<span className={css.count}>
    {pending} {pending===1?'واجب':'واجبات'} للمتابعة
   </span>}
  </header>
  <nav className={css.tabs} aria-label="أقسام تدريباتي" role="tablist">
   {tabs.map(item=><button key={item.id} type="button" role="tab"
    id={'training-tab-'+item.id} aria-selected={tab===item.id}
    aria-controls={'training-panel-'+item.id}
    className={tab===item.id?css.tabActive:css.tab}
    onClick={()=>changeTab(item.id)}>{item.label}</button>)}
  </nav>

  {tab==='homework'&&!demo&&<section id="training-panel-homework" role="tabpanel" aria-labelledby="training-tab-homework">
   <StudentPublishedAssignments key={selected.profile.id} learnerId={selected.profile.id}/>
  </section>}
  {tab==='homework'&&demo&&<section className={css.content} id="training-panel-homework"
   role="tabpanel" aria-labelledby="training-tab-homework">
   <div className={css.sectionHeading}><h2>واجباتي من الشيخ</h2></div>
   {selected.tasks.length===0?
    <div className={css.emptyBox}><strong>لا توجد واجبات من الشيخ الآن.</strong>
     <button type="button" className={css.outlineButton} onClick={()=>changeTab('practice')}>ابدأ تدريبًا حرًا</button>
    </div>:
    <div className={css.cards}>{selected.tasks.map(task=>{
     const isPrepared=preparedTasks.includes(task.id);
     const completed=finished.includes(task.id);
     const isOpen=task.id===openTask;
     const bound=validAssignmentRange(task.quranRange);
     const noteVisible=openNote===task.id;
     return <article key={task.id} className={isOpen?css.cardExpanded:css.card}>
      <div className={css.rowBetween}><span className={css.tag}>
       {task.kind==='revision'?'مراجعة':task.kind==='recitation'?'تلاوة':'حفظ'}</span>
       <span className={isPrepared?css.statusReady:css.statusPending}>
        {isPrepared?'جاهز للمراجعة':completed?'راجعته بنفسي':'قيد العمل'}
       </span></div>
      <div className={css.taskMain}><div>
       <h3>{task.title}</h3><p>{task.scope}</p>
       {task.repetitions!==null&&<small>التكرار: {task.repetitions} مرات</small>}
      </div><div className={css.actions}>
       <button type="button" className={css.primaryButton} disabled={!bound} aria-expanded={isOpen}
        onClick={()=>{setOpenTask(isOpen?null:task.id);setNotice('');}}>
        {isOpen?'إغلاق المصحف':'ابدأ في المصحف'}
       </button>
       <button type="button" className={css.outlineButton} aria-expanded={noteVisible}
        onClick={()=>setOpenNote(noteVisible?null:task.id)}>ملاحظتي</button>
      </div></div>
      {!bound&&<p className={css.error}>لا يمكن فتح الآيات قبل توثيق نطاق الواجب.</p>}
      {isOpen&&bound&&<TrainingQuranSession key={task.id} range={task.quranRange!}
       title={task.title} onClose={()=>setOpenTask(null)}/>}
      {noteVisible&&<div className={css.draftArea}>
       <label htmlFor={'training-draft-'+task.id}>ملاحظة قبل الحصة</label>
       <textarea id={'training-draft-'+task.id} rows={2} maxLength={500}
        value={taskDrafts[task.id]??''} placeholder="إيه اللي عايز تراجعه؟"
        onChange={event=>{updateTaskDraft(task.id,event.target.value);setNotice('');}}/>
       <div className={css.rowBetween}>
        <span className={css.subtle}>مسودة معاينة محلية، لا تُرسل للشيخ.</span>
        <button type="button" className={css.outlineButton}
         disabled={!(taskDrafts[task.id]??'').trim()||isPrepared}
         onClick={()=>{if(markTaskPrepared(task.id))setNotice('تم تجهيز ملاحظتك محليًا.');}}>
         {isPrepared?'مُجهز ✓':'جهّز للمراجعة'}</button>
       </div>
       {notice&&<p className={css.notice} role="status">{notice}</p>}
      </div>}
      <label className={css.checkLabel}><input type="checkbox" checked={completed}
       onChange={()=>toggleTask(task.id)}/> راجعته بنفسي</label>
     </article>;
    })}</div>}
  </section>}

  {tab==='practice'&&<section className={css.content} id="training-panel-practice"
   role="tabpanel" aria-labelledby="training-tab-practice">
   <div className={css.sectionHeading}><div>
    <h2>اختر سورة وابدأ</h2><p>تدريب ذاتي على نفس المصحف.</p>
   </div><Link href="/student/mushaf" className={css.outlineButton}>المصحف الكامل</Link></div>
   <div className={css.sampleGrid}>{VOLUNTARY_SAMPLES.map((sample,index)=>
    <button type="button" key={sample.range.surah}
     className={openPractice===index?css.sampleActive:css.sample}
     aria-pressed={openPractice===index}
     onClick={()=>setOpenPractice(openPractice===index?null:index)}>
     <strong>سورة {sample.name}</strong>
     <span>الآيات {sample.range.fromAyah}–{sample.range.toAyah}</span>
     <em>{openPractice===index?'إغلاق':'ابدأ ←'}</em>
    </button>)}</div>
   {openPractice!==null&&<TrainingQuranSession key={openPractice}
    title={'تدريب سورة '+VOLUNTARY_SAMPLES[openPractice]!.name}
    range={VOLUNTARY_SAMPLES[openPractice]!.range}
    onClose={()=>setOpenPractice(null)}/>}
  </section>}

  {tab==='prepare'&&!demo&&<StudentConnectedPreparation key={selected.profile.id}
   learnerId={selected.profile.id} onHomework={()=>changeTab('homework')}
   onPractice={()=>changeTab('practice')}/>}
  {tab==='prepare'&&demo&&<section className={css.content} id="training-panel-prepare"
   role="tabpanel" aria-labelledby="training-tab-prepare">
   <div className={css.sectionHeading}><h2>استعداد للحصة</h2>
    <Link href="/student/lessons" className={css.outlineButton}>جدول حصصي</Link></div>
   {upcoming?<div className={css.prepareCard}>
    <div className={css.rowBetween}><strong>{upcoming.topic}</strong>
     <span className={css.tag}>{upcoming.dayOffset===0?'اليوم':'بعد '+upcoming.dayOffset+' يوم'}</span></div>
    <p>{upcoming.time} · {upcoming.teacher} · {upcoming.durationMinutes} دقيقة (مثال)</p>
    <div className={css.prepRows}>
     <div><span>١</span><strong>راجع واجباتك</strong>
      <button type="button" className={css.textAction} onClick={()=>changeTab('homework')}>فتح واجباتي</button></div>
     <div><span>٢</span><strong>اختبر حفظك</strong>
      <button type="button" className={css.textAction} onClick={()=>changeTab('practice')}>تدريب حر</button></div>
     <div><span>٣</span><strong>راجع تصحيحات الشيخ</strong>
      <Link href="/student/lessons#notebook" className={css.textAction}>سجل الحصص</Link></div>
    </div>
   </div>:<div className={css.emptyBox}><strong>لا توجد حصة قادمة في بيانات المعاينة.</strong>
    <button type="button" className={css.primaryButton} onClick={()=>changeTab('practice')}>ابدأ الحفظ والمراجعة</button>
   </div>}
  </section>}
 </div>;
}
