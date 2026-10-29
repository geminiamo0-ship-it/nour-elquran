'use client';
import {useState} from 'react';
import {useTeacher} from './TeacherContext';
import {canEditLearnerPlan,reportForLearner} from './domain';
import {Empty,Panel,Pill,SectionHeading} from './TeacherUI';
import styles from './TeacherPortal.module.css';

type ProfileTab='overview'|'plan'|'mushaf'|'recitations'|'reports'|'assignments';
const tabs:readonly {id:ProfileTab;label:string}[]=[
  {id:'overview',label:'نظرة عامة'},{id:'plan',label:'الحفظ والمراجعة'},
  {id:'mushaf',label:'المصحف والتصحيحات'},{id:'recitations',label:'التسميعات'},
  {id:'reports',label:'التقارير'},{id:'assignments',label:'الواجبات'},
];
export function TeacherStudents(){
  const {learners,lessons,assignments,reports,selectedLearnerId,setSelectedLearnerId,updatePlan}=useTeacher();
  const [query,setQuery]=useState('');
  const [tab,setTab]=useState<ProfileTab>('overview');
  const [draftWird,setDraftWird]=useState('');
  const [draftRevision,setDraftRevision]=useState('');
  const [editing,setEditing]=useState(false);
  const shown=learners.filter(learner=>learner.name.includes(query.trim())||learner.level.includes(query.trim()));
  const learner=learners.find(l=>l.id===selectedLearnerId)??shown[0]??null;
  const isPrimary=learner?canEditLearnerPlan(learner):false;
  const myReports=learner&&isPrimary?reportForLearner(reports,learner.id):[];
  const myTasks=learner&&isPrimary?assignments.filter(a=>a.learnerId===learner.id):[];
  const myLessons=learner?lessons.filter(l=>l.learnerId===learner.id):[];
  const select=(id:string)=>{
    setSelectedLearnerId(id);setTab('overview');setEditing(false);
  };
  function startPlanEdit(){
    if(!learner||!isPrimary)return;
    setDraftWird(learner.nextWird);setDraftRevision(learner.revision);setEditing(true);
  }
  return <div>
    <SectionHeading eyebrow="المتابعة الأكاديمية" title="طلابي" description="كل طالب له ملف تعليمي مستقل، مع الفصل بين بياناته الخاصة والخطة التي يحررها الشيخ الأساسي."/>
    <div className={styles.studentsLayout}>
      <section className={styles.roster}>
        <label className={styles.fieldLabel} htmlFor="student-search">بحث بالاسم أو المستوى</label>
        <input id="student-search" className={styles.input} value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث عن طالب..."/>
        <div className={styles.rosterList} aria-label="الطلاب المصرح بهم">
          {shown.length?shown.map(l=><button type="button" key={l.id}
            aria-pressed={learner?.id===l.id} onClick={()=>select(l.id)}
            className={learner?.id===l.id?styles.rosterActive:styles.rosterItem}>
            <span className={styles.studentCircle}>{l.name.slice(-1)}</span>
            <span className={styles.rosterText}><strong>{l.name}</strong><small>{l.level}</small>
              {!l.primaryTeacher&&<em>صلاحية درس بديل محدودة</em>}</span>
            <span aria-hidden="true">‹</span>
          </button>):<Empty title="لا يوجد طلاب مطابقون" description="لا يمكن الوصول إلى أي ملف غير مسند لهذا الشيخ."/>}
        </div>
      </section>
      <div className={styles.studentDetail}>
        {learner?<><div className={styles.profileHero}>
          <div className={styles.studentCircleLarge} aria-hidden="true">۞</div>
          <div><span className={styles.eyebrow}>الملف التعليمي</span><h2>{learner.name}</h2>
            <p>{learner.level} · {learner.primaryTeacher?'الشيخ الأساسي':'شيخ بديل لهذه الحصة فقط'}</p></div>
          {learner.primaryTeacher?<Pill tone="good">ملف مصرح به</Pill>:<Pill tone="warning">ملخص مقيد</Pill>}
        </div>
        {!learner.primaryTeacher&&<div className={styles.warningNote}>لا يرى الشيخ البديل تاريخ الطالب الكامل ولا ملاحظاته الخاصة، وتنتهي صلاحية الملخص التعليمي عند نهاية الحصة التي درسها.</div>}
        <nav role="tablist" className={styles.tabs} aria-label="أقسام ملف الطالب">
          {tabs.filter(t=>isPrimary||['overview','plan'].includes(t.id)).map(t=><button type="button" role="tab" key={t.id}
            aria-selected={tab===t.id} onClick={()=>{setTab(t.id);setEditing(false);}}
            className={tab===t.id?styles.tabActive:styles.tab}>{t.label}</button>)}
        </nav>
        {tab==='overview'&&<div className={styles.twoColumns}>
          <Panel title="الورد والتحضير" compact><p className={styles.labelText}>الورد القادم</p><strong>{learner.nextWird}</strong><p className={styles.labelText}>المراجعة</p><strong>{learner.revision}</strong><p className={styles.labelText}>نقطة التركيز</p><p>{learner.focus}</p></Panel>
          <Panel title="آخر متابعة" compact>
            {isPrimary?<><div className={styles.gradeRow}>{[
              {label:'حفظ',value:learner.latestScores.hifz},{label:'تلاوة',value:learner.latestScores.recitation},{label:'تجويد',value:learner.latestScores.tajweed},
            ].map(g=><div key={g.label}><span>{g.label}</span><strong>{g.value===null?'لم يُقيّم':g.value+'/10'}</strong></div>)}</div>
              <p className={styles.helpText}>الدرجات مستقلة؛ لا يوجد متوسط إجباري ولا درجة مفقودة تتحول إلى صفر.</p></>:
              <p className={styles.helpText}>التقييمات التاريخية غير متاحة للشيخ البديل. يُعرض فقط ملخص التحضير المصرح به.</p>}
          </Panel>
        </div>}
        {tab==='plan'&&<Panel title={isPrimary?'خطة الحفظ والمراجعة':'ملخص الورد المصرح به'}
          extra={isPrimary&&!editing?<button type="button" className={styles.secondaryButton} onClick={startPlanEdit}>تعديل الخطة</button>:undefined}>
          {editing&&isPrimary?<form className={styles.formStack} onSubmit={e=>{e.preventDefault();if(updatePlan(learner.id,draftRevision,draftWird))setEditing(false);}}>
            <label className={styles.fieldLabel} htmlFor="plan-wird">ورد الحفظ القادم</label>
            <input id="plan-wird" className={styles.input} maxLength={300} required value={draftWird} onChange={e=>setDraftWird(e.target.value)}/>
            <label className={styles.fieldLabel} htmlFor="plan-revision">خطة المراجعة</label>
            <textarea id="plan-revision" className={styles.textarea} maxLength={500} required rows={3} value={draftRevision} onChange={e=>setDraftRevision(e.target.value)}/>
            <p className={styles.helpText}>في النظام الفعلي: كل تعديل يُحفظ بإصدار وسجل الشيخ والوقت، ولا يتغير واجب منشور دون قرار نشر مستقل.</p>
            <div className={styles.actions}><button type="submit" className={styles.primaryButton}>حفظ الخطة التجريبية</button><button type="button" className={styles.secondaryButton} onClick={()=>setEditing(false)}>إلغاء</button></div>
          </form>:<div className={styles.detailList}>
            <p><b>الحفظ:</b> {learner.nextWird}</p><p><b>المراجعة:</b> {learner.revision}</p><p><b>التركيز:</b> {learner.focus}</p>
            {!isPrimary&&<p>لا يمكن تغيير خطة الطالب الدائمة بواسطة الشيخ البديل.</p>}
          </div>}
        </Panel>}
        {tab==='mushaf'&&<Panel title="المصحف وتصحيحات الحصص">
          <Empty title="طبقة المصحف المعتمدة ستظهر هنا" description="نستخدم المصحف الأصلي الموجود بالمنصة. العلامات الخاصة بالطالب لا تظهر للشيخ، والتصحيحات المنشورة فقط تُعرض في الملف الرسمي."/>
        </Panel>}
        {tab==='recitations'&&<Panel title="التسميعات الواردة">
          {myTasks.filter(a=>a.kind==='recitation').length?myTasks.filter(a=>a.kind==='recitation').map(task=><p key={task.id} className={styles.detailRow}>سورة {task.surahName} — {task.fromAyah} إلى {task.toAyah} · {task.status==='awaiting-review'?'تنتظر التصحيح':'تابع من الواجبات'}</p>):
            <Empty title="لا توجد تسميعات ضمن هذا الملف" description="لن نعرض تسجيلات صوتية لطلاب آخرين أو روابط تخزين عامة."/>}
        </Panel>}
        {tab==='reports'&&<Panel title="سجل التقارير">
          {myReports.length?myReports.map(report=><p className={styles.detailRow} key={report.id}>{report.scope} · <Pill tone={report.status==='published'?'good':'warning'}>{report.status==='published'?'معتمد':'مسودة خاصة'}</Pill> · نسخة {report.revision}</p>):
            <Empty title="لا توجد تقارير مسموحة" description="المسودات لا تظهر للطالب؛ نشر التقارير يحتاج موافقة الشيخ."/>}
        </Panel>}
        {tab==='assignments'&&<Panel title="الواجبات المخصصة">
          {myTasks.length?myTasks.map(task=><p className={styles.detailRow} key={task.id}>سورة {task.surahName} {task.fromAyah}–{task.toAyah} · {task.dueDate}</p>):
            <Empty title="لا توجد واجبات" description="لن ننسب للطالب واجبًا لم ينشره الشيخ."/>}
        </Panel>}
        <p className={styles.helpText}>حصص مرتبطة بالملف: {myLessons.length} · جميع البيانات المعروضة الآن للتجربة وليست سجلات أكاديمية فعلية.</p>
        </>:<Empty title="اختر ملف طالب" description="تظهر هنا فقط الملفات التي يصرح بها نظام التعيينات للشيخ."/>}
      </div>
    </div>
  </div>;
}
