'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useStudent } from '../StudentContext';
import { nextBookedLesson, validAssignmentRange, VOLUNTARY_SAMPLES } from '../quranAssignment';
import { TrainingQuranSession } from './TrainingQuranSession';
import {StudentPublishedAssignments} from './StudentPublishedAssignments';
import css from './TrainingWorkspace.module.css';

type Tab = 'homework' | 'prepare' | 'practice';
export function TrainingWorkspace(){
  const {selected,finished,toggleTask,taskDrafts,updateTaskDraft,preparedTasks,markTaskPrepared}=useStudent();
  const [tab,setTab]=useState<Tab>('homework');
  const [openTask,setOpenTask]=useState<string|null>(null);
  const [openPractice,setOpenPractice]=useState(-1);
  const [notice,setNotice]=useState('');
  const upcoming=nextBookedLesson(selected.lessons);
  const total=selected.tasks.length;
  const done=selected.tasks.filter(t=>finished.includes(t.id)).length;
  const counts={homework:total,prepare:upcoming?1:0,practice:VOLUNTARY_SAMPLES.length};

  function changeTab(next:Tab){
    setTab(next);setOpenTask(null);setOpenPractice(-1);setNotice('');
  }
  return <div className={css.workspace} aria-label="تدريباتي">
    <section className={css.intro}>
      <div>
        <p className={css.overline}>مسار التعلم · واجباتي ومراجعتي</p>
        <h2>كل تدريب له هدف واضح، ونفس المصحف لعرض الآيات</h2>
        <p>ابدأ بواجبات الشيخ، ثم استعد للحصة القادمة، وبعدها تدرب على الحفظ والمراجعة الذاتية كما تحب. دفتر الحصص يحتفظ بما تعلّمته في اللقاءات السابقة.</p>
      </div>
      <div className={css.summaryBox}>
        <span>{selected.profile.demo?'الواجبات في المعاينة':'الواجبات المعتمدة'}</span><strong>{selected.profile.demo?done+' / '+total:'من الشيخ'}</strong>
        <small>{selected.profile.demo?'علامات إنجاز داخل الصفحة فقط':'قائمة الخادم دون تسليم تلقائي'}</small>
      </div>
    </section>

    <nav className={css.tabs} aria-label="أقسام تدريباتي" role="tablist">
      {([
        {id:'homework',label:'واجباتي',caption:'المطلوب من الشيخ'},
        {id:'prepare',label:'الاستعداد للحصة',caption:'خطوات اللقاء القادم'},
        {id:'practice',label:'الحفظ والمراجعة',caption:'تدريب ذاتي'},
      ] as const).map(item=><button key={item.id} type="button" role="tab"
        id={'training-tab-'+item.id} aria-selected={tab===item.id}
        aria-controls={'training-panel-'+item.id}
        className={tab===item.id?css.tabActive:css.tab}
        onClick={()=>changeTab(item.id)}>
        <span>{item.label}</span><small>{item.caption}</small>
        {item.id==='homework'&&<em>{counts.homework}</em>}
      </button>)}
    </nav>

    {tab==='homework'&&!selected.profile.demo&&<StudentPublishedAssignments key={selected.profile.id} learnerId={selected.profile.id}/>}
    {tab==='homework'&&selected.profile.demo&&<section id="training-panel-homework" role="tabpanel" aria-labelledby="training-tab-homework" className={css.content}>
      <div className={css.sectionHeading}><div>
        <p className={css.overline}>الواجبات المعتمدة في بيانات العرض</p>
        <h3>واجباتي من الشيخ</h3>
      </div><span className={css.muted}>لا تُرسل أي بيانات إلى الشيخ من هذه المعاينة.</span></div>
      {selected.tasks.length===0?
        <div className={css.emptyBox}>
          <strong>لا توجد تكليفات معتمدة من شيخ لهذا الطالب.</strong>
          <p>يمكنك التدريب الحر بنفسك الآن. لن ننسب هذا التدريب إلى الشيخ أو نعتبره واجبًا رسميًا.</p>
          <button type="button" className={css.primaryButton} onClick={()=>changeTab('practice')}>ابدأ تدريبًا ذاتيًا</button>
        </div>:
        <div className={css.cards}>{selected.tasks.map(task=>{
          const isPrepared=preparedTasks.includes(task.id);
          const completed=finished.includes(task.id);
          const isOpen=task.id===openTask;
          const bound=validAssignmentRange(task.quranRange);
          return <article key={task.id} className={isOpen?css.cardExpanded:css.card}>
            <div className={css.rowBetween}>
              <span className={css.tag}>{task.kind==='revision'?'مراجعة':task.kind==='recitation'?'تلاوة':'حفظ'}</span>
              <span className={isPrepared?css.statusReady:css.statusPending}>{isPrepared?'جهزت مسودتي محليًا':'قيد العمل'}</span>
            </div>
            <h4>{task.title}</h4>
            <p>{task.scope}</p>
            {task.repetitions!==null&&<small>التكرار المقترح: {task.repetitions} مرات</small>}
            <div className={css.actions}>
              <button type="button" className={css.primaryButton} disabled={!bound}
                aria-expanded={isOpen} onClick={()=>{setOpenTask(isOpen?null:task.id);setNotice('');}}>
                {isOpen?'إغلاق المصحف التدريبي':'ابدأ الواجب في المصحف'}</button>
              <label className={css.checkLabel}><input type="checkbox" checked={completed}
                onChange={()=>toggleTask(task.id)}/> راجعته بنفسي</label>
            </div>
            {!bound&&<p className={css.error}>الواجب يحتاج مرجع آيات معتمدًا قبل عرضه في المصحف.</p>}
            {isOpen&&bound&&<TrainingQuranSession key={task.id} range={task.quranRange!}
              title={task.title} onClose={()=>setOpenTask(null)}/>}
            <div className={css.draftArea}>
              <label htmlFor={'training-draft-'+task.id}>ملاحظتي قبل الحصة</label>
              <textarea id={'training-draft-'+task.id} rows={2} maxLength={500}
                value={taskDrafts[task.id]??''} placeholder="ما الذي احتجت لمراجعته؟"
                onChange={e=>{updateTaskDraft(task.id,e.target.value);setNotice('');}}/>
              <div className={css.rowBetween}>
                <span className={css.subtle}>مسودة مؤقتة، لا تسليم تلقائي ولا صوت مرسل.</span>
                <button type="button" className={css.outlineButton}
                  disabled={!(taskDrafts[task.id]??'').trim()||isPrepared}
                  onClick={()=>{if(markTaskPrepared(task.id))setNotice('جهزت المسودة محليًا. لم يتم إرسال واجب للشيخ.');}}>
                  {isPrepared?'مُجهز محليًا ✓':'جهّز للمراجعة'}</button>
              </div>
              {notice&&isOpen&&<p role="status" className={css.notice}>{notice}</p>}
            </div>
          </article>;
        })}</div>}
    </section>}

    {tab==='practice'&&<section id="training-panel-practice" role="tabpanel" aria-labelledby="training-tab-practice" className={css.content}>
      <div className={css.sectionHeading}><div>
        <p className={css.overline}>تدريب مستقل، مش واجبًا من الشيخ</p>
        <h3>احفظ وراجع على راحتك</h3></div>
        <span className={css.muted}>ابدأ من نماذج سور قصيرة موثّقة.</span>
      </div>
      <div className={css.sampleGrid}>
        {VOLUNTARY_SAMPLES.map((sample,index)=>
          <button type="button" key={sample.range.surah} className={openPractice===index?css.sampleActive:css.sample}
            aria-pressed={openPractice===index}
            onClick={()=>setOpenPractice(openPractice===index?-1:index)}>
            <strong>سورة {sample.name}</strong>
            <span>الآيات {sample.range.fromAyah}–{sample.range.toAyah}</span>
            <small>{openPractice===index?'إغلاق التدريب':'تدريب الحفظ والمراجعة'}</small>
          </button>)}
      </div>
      {openPractice>=0&&<TrainingQuranSession key={openPractice}
        title={'تدريب سورة '+VOLUNTARY_SAMPLES[openPractice]!.name}
        range={VOLUNTARY_SAMPLES[openPractice]!.range}
        onClose={()=>setOpenPractice(-1)}/>}
      {openPractice<0&&<div className={css.softHint}>
        <strong>إيه اللي هتعمله داخل التدريب؟</strong>
        <p>تقرأ نفس صفحة المصحف، تحدد الآيات، تخفيها لاختبار نفسك، وتسمع الآية أو تسجّل تسميعًا محليًا اختياريًا.</p>
        <Link href="/student/mushaf">افتح المصحف الكامل للقراءة الحرة</Link>
      </div>}
    </section>}

    {tab==='prepare'&&<section id="training-panel-prepare" role="tabpanel" aria-labelledby="training-tab-prepare" className={css.content}>
      <div className={css.sectionHeading}><div>
        <p className={css.overline}>قبل اللقاء القادم</p>
        <h3>الاستعداد للحصة</h3></div>
        <Link href="/student/lessons" className={css.outlineButton}>الجدول والحصص</Link>
      </div>
      {upcoming?<div className={css.prepareCard}>
        <div className={css.rowBetween}>
          <strong>{upcoming.topic}</strong><span className={css.tag}>{upcoming.dayOffset===0?'اليوم':'بعد '+upcoming.dayOffset+' يوم'}</span>
        </div>
        <p>المعلم: {upcoming.teacher} · الموعد: {upcoming.time} · المدة: {upcoming.durationMinutes} دقيقة</p>
        <h4>قائمة التحضير</h4>
        <div className={css.prepRows}>
          <div><span>١</span><p>راجع واجباتك من صفحة «واجباتي» وحدد ما لم تتقنه.</p>
            <button type="button" className={css.textAction} onClick={()=>changeTab('homework')}>فتح واجباتي</button></div>
          <div><span>٢</span><p>جرّب التسميع الذاتي للآيات المستهدفة، واستمع للتلاوة.</p>
            <button type="button" className={css.textAction} onClick={()=>changeTab('practice')}>تدريب حر</button></div>
          <div><span>٣</span><p>راجع آخر تصحيحات وملاحظات الشيخ في دفتر الحصص.</p>
            <Link href="/student/notebook" className={css.textAction}>دفتر الحصص</Link></div>
        </div>
        <p className={css.subtle}>هذه الخطوات للمساعدة في التحضير؛ ليست مهامًا جديدة أو إثبات حضور.</p>
      </div>:<div className={css.emptyBox}>
        <strong>لا توجد حصة قادمة مؤكدة لهذا الطالب في بيانات المعاينة.</strong>
        <p>تقدر تراجع محفوظك أو تقرأ في المصحف بحرية من غير اختلاق موعد أو تكليف.</p>
        <button type="button" className={css.primaryButton} onClick={()=>changeTab('practice')}>انتقل للحفظ والمراجعة</button>
      </div>}
    </section>}

    <p className={css.footnote}>تدريباتي للعمل القادم؛ دفتر الحصص لسجل ما حدث؛ والمصحف هو مرجع الطالب الواحد. {selected.profile.demo?'هذه الواجهة تجريبية ولا تحفظ درجات أو ملفات صوتية على خادم.':'الواجبات والتسليم الكتابي وتصحيحه متصلة بالخادم؛ التسجيل الصوتي للتدريب المحلي فقط، ولا يُرفع للشيخ حتى تفعيل الخدمة الآمنة.'}</p>
  </div>;
}
