'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useTeacher} from './TeacherContext';
import {canReportStudentAbsent,canStartLesson,hasTeacherDelayEscalation,shouldWarnOvertime,type LessonStatus} from './domain';
import {Empty,Panel,Pill,SectionHeading,TeacherLessonCard,LessonStatusHelp} from './TeacherUI';
import styles from './TeacherPortal.module.css';

type Filter='all'|LessonStatus;
const filters:readonly {id:Filter;label:string}[]=[
  {id:'all',label:'الكل'},{id:'scheduled',label:'القادمة'},{id:'waiting',label:'غرفة الانتظار'},
  {id:'live',label:'مباشرة'},{id:'completed',label:'المنتهية'},{id:'cancelled',label:'الملغاة'},
];
export function TeacherSchedule(){
  const {lessons,learners,selectedLessonId,setSelectedLessonId,reportNoShow,scenario}=useTeacher();
  const [filter,setFilter]=useState<Filter>('all');
  const [mode,setMode]=useState<'list'|'week'>('week');
  const shown=lessons.filter(l=>filter==='all'||l.status===filter);
  const active=lessons.find(l=>l.id===selectedLessonId)??shown[0]??null;
  return <div>
    <SectionHeading eyebrow="المواعيد والحضور" title="جدولي وحصصي" description="الحجز الواحد يشغل ٤٠ دقيقة متصلة؛ موعد الحصة التالية لا يتحرك تلقائيًا عند التأخر أو الانقطاع."
      action={<div className={styles.segmented}><button type="button" aria-pressed={mode==='week'} onClick={()=>setMode('week')}>أسبوعي</button><button type="button" aria-pressed={mode==='list'} onClick={()=>setMode('list')}>قائمة</button></div>}/>
    <div className={styles.infoBar}>◷ وقت التعليم المستهدف: <b>٣٠ دقيقة</b> · فترة الحجز: <b>٤٠ دقيقة</b> · بدء وإنهاء الفصل دائمًا بيد الشيخ.</div>
    <div className={styles.filterBar}>{filters.map(item=><button key={item.id} type="button" aria-pressed={filter===item.id} onClick={()=>setFilter(item.id)}>{item.label}</button>)}</div>
    {mode==='week'&&<div className={styles.weekGrid} aria-label="ملخص الأسبوع">
      {['الأربعاء','الخميس','الجمعة','السبت','الأحد','الاثنين','الثلاثاء'].map((day,i)=><div key={day} className={i===1?styles.weekToday:styles.weekDay}><strong>{day}</strong><small>{i===1?'٢٩ أكتوبر':i===2?'٣٠ أكتوبر':'معاينة'}</small><span>{i===1?lessons.filter(l=>l.day==='اليوم').length:i===2?lessons.filter(l=>l.day==='غدًا').length:0} حصة</span></div>)}
    </div>}
    <div className={styles.twoColumnsWide}>
      <Panel title="المواعيد المسجلة" extra={<Pill tone="neutral">{shown.length} حصة</Pill>}>
        {shown.length?shown.map(l=><button key={l.id} type="button" aria-pressed={active?.id===l.id}
          className={active?.id===l.id?styles.selectedLesson:styles.selectableLesson}
          onClick={()=>setSelectedLessonId(l.id)}>
          <TeacherLessonCard lesson={l} learner={learners.find(x=>x.id===l.learnerId)} showActions={false}/>
        </button>):<Empty title="لا توجد حصص بهذا التصنيف" description="يمكن تغيير فلتر الحالة. الحصص الملغاة ليست قابلة للانضمام."/>}
      </Panel>
      <Panel title="تفاصيل الحصة المحددة">
        {active?<><div className={styles.detailList}>
          <p><b>الطالب:</b> {learners.find(x=>x.id===active.learnerId)?.name??'غير متاح'}</p>
          <p><b>الموعد:</b> {active.day} {active.startsAt} – {active.reservedUntil}</p>
          <p><b>حالة الشيخ:</b> {active.teacherPresent?'داخل الانتظار':'لم ينضم'}</p>
          <p><b>حالة الطالب:</b> {active.learnerPresent?'داخل الانتظار':'لم ينضم'}</p>
          {active.isSubstitute&&<p><b>شيخ بديل:</b> {active.guardianAccepted?'موافقة ولي الأمر مثبتة في بيانات المثال':'لم يعتمد ولي الأمر'}</p>}
        </div>
        <div className={styles.actions}><Link href="/teacher/preparation" className={styles.primaryButton}>التحضير لهذه الحصة</Link>
          <button type="button" disabled className={styles.secondaryButton} title="لا توجد غرفة متصلة بعد">{canStartLesson(active)?'بدء الفصل (بعد ربط LiveKit)':'انتظار دخول الطرفين'}</button>
        </div>
        {canReportStudentAbsent(active)&&<div className={styles.warningNote}>
          الطالب لم يحضر بعد مرور ١٥ دقيقة. يمكن تسجيل بلاغ مبدئي؛ ولو وصل لاحقًا يُسمح للشيخ ببدء الحصة.
          <button type="button" className={styles.secondaryButton} onClick={()=>reportNoShow(active.id)}>تسجيل بلاغ تجريبي</button>
        </div>}
        {hasTeacherDelayEscalation(active)&&<div className={styles.warningNote}>تأخر الشيخ أكثر من ١٠ دقائق؛ تصعيد الإدارة واجب، وللطالب حق مغادرة الانتظار وطلب التعويض دون اعتباره غائبًا.</div>}
        {scenario==='disconnect'&&active.status==='live'&&<div className={styles.warningNote}>انقطع اتصال الطالب؛ يجب استعادة الحالة بعد العودة ولا يجوز إنهاء الحصة تلقائيًا.</div>}
        {shouldWarnOvertime(active)&&<div className={styles.warningNote}>تم تجاوز ٤٠ دقيقة: لا إغلاق تلقائي ولا تأجيل خفي للحصة التالية؛ يلزم تنبيه الشيخ والإدارة بالتعارض.</div>}
        <LessonStatusHelp/></>:<Empty title="اختر حصة" description="إذا لم يكن لديك أي حصص فلن نظهر زر دخول غير مصرح به."/>}
      </Panel>
    </div>
    <p className={styles.helpText}>ملاحظات التنفيذ: التأخير يُقاس من موعد الحجز الرسمي؛ الإلغاء قبل ٦ ساعات والتغييرات المتأخرة تحتاج القواعد المعتمدة، دون تعديل الجدول من المعاينة.</p>
  </div>;
}
