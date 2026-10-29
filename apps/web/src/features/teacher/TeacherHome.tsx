'use client';
import Link from 'next/link';
import {useTeacher} from './TeacherContext';
import {nextTeachingSlot} from './domain';
import {Empty,Panel,Pill,SectionHeading,TeacherLessonCard,LessonStatusHelp} from './TeacherUI';
import styles from './TeacherPortal.module.css';

export function TeacherHome() {
  const {learners,lessons,reports,assignments,notices,incidents}=useTeacher();
  const next=nextTeachingSlot(lessons);
  const pendingReports=reports.filter(r=>r.status==='draft').length;
  const pendingRecitations=assignments.filter(a=>a.status==='awaiting-review').length;
  const active=lessons.filter(l=>l.day==='اليوم'&&l.status!=='cancelled');
  return <div>
    <SectionHeading eyebrow="مساحة التدريس · لوحة العمل" title="أهلًا بك في نور القرآن"
      description="حِصصك القادمة، وما يحتاج منك قرارًا، وتحضيرك لكل طالب في مكان واحد."
      action={<Link href="/teacher/schedule" className={styles.primaryButton}>عرض الجدول ←</Link>}/>
    <div className={styles.metricGrid}>
      {[
        {label:'حصص اليوم',value:active.length,sub:'محجوزة في الجدول'},
        {label:'طلابي المصرح بهم',value:learners.filter(x=>x.primaryTeacher).length,sub:'الشيخ الأساسي'},
        {label:'تقارير تحتاج الاعتماد',value:pendingReports,sub:'لا تظهر للطالب'},
        {label:'تسميعات تنتظر التصحيح',value:pendingRecitations,sub:'محاولات صوتية خاصة'},
      ].map(item=><div className={styles.metric} key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.sub}</small></div>)}
    </div>
    <div className={styles.hero}>
      <div><span className={styles.heroKicker}>✦ خطوتك التعليمية التالية</span>
        <h2>{next?'استعد للحصة القادمة':'جدولك خالٍ من الحصص القادمة'}</h2>
        <p>{next?'اطلع على الورد السابق وأخطاء الحصة الماضية قبل دخول غرفة الانتظار. لا يبدأ الفصل إلا بوجود الشيخ والطالب معًا.':'عند إسناد أول طالب لك ستظهر حصصه والتحضير المناسب هنا تلقائيًا بعد الربط.'}</p>
      </div><div className={styles.heroAction}><Link href={next?'/teacher/preparation':'/teacher/schedule'} className={styles.goldButton}>{next?'فتح التحضير':'عرض الجدول'}</Link></div>
    </div>
    <div className={styles.twoColumns}>
      <Panel title="الحصة التالية" extra={<Link href="/teacher/schedule" className={styles.textLink}>كل المواعيد</Link>}>
        {next?<><TeacherLessonCard lesson={next} learner={learners.find(l=>l.id===next.learnerId)}/>
          <LessonStatusHelp/></>:<Empty title="لا توجد حصة منتظرة" description="لا نعرض موعدًا أو اسم طالب افتراضي عند اختيار سيناريو الشيخ الجديد."/>}
      </Panel>
      <Panel title="مهام تحتاج متابعتك" extra={<Pill tone="warning">{pendingReports+pendingRecitations+incidents.filter(c=>c.status==='pending').length} إجراء</Pill>}>
        <div className={styles.actionList}>
          {[
            {title:'تقارير لم تُعتمد',count:pendingReports,href:'/teacher/reports',desc:'مراجعة الدرجات والنشر'},
            {title:'تسميعات صوتية',count:pendingRecitations,href:'/teacher/assignments',desc:'الاستماع والتصحيح'},
            {title:'بلاغات تحتاج متابعة',count:incidents.filter(c=>c.status==='pending').length,href:'/teacher/cases',desc:'تُراجع الإدارة التعويضات'},
          ].map(item=><Link key={item.title} href={item.href} className={styles.actionRow}>
            <span><b>{item.title}</b><small>{item.desc}</small></span>
            <strong>{item.count}</strong><span aria-hidden="true">↗</span>
          </Link>)}
        </div>
      </Panel>
    </div>
    <div className={styles.twoColumns}>
      <Panel title="جدول اليوم" extra={<Link href="/teacher/schedule" className={styles.textLink}>الجدول الأسبوعي</Link>}>
        {active.length?active.map(item=><TeacherLessonCard key={item.id} lesson={item} learner={learners.find(l=>l.id===item.learnerId)} showActions={false}/>):<Empty title="لا توجد حصص اليوم" description="الجدول يعكس ما هو متاح حاليًا في معاينة السيناريو."/>}
      </Panel>
      <Panel title="آخر التنبيهات" extra={<Link href="/teacher/notifications" className={styles.textLink}>مركز الإشعارات</Link>}>
        {notices.length?notices.slice(0,3).map(item=><Link href={'/teacher/'+item.section} key={item.id} className={styles.noticeRow}>
          <span aria-hidden="true" className={styles.noticeDot}>{item.read?'○':'●'}</span>
          <span><b>{item.text}</b><small>{item.detail}</small></span><span aria-hidden="true">↗</span>
        </Link>):<Empty title="لا توجد إشعارات" description="التنبيهات الحقيقية ستظهر من النظام المعتمد، دون افتراض حضور أو تسليم."/>}
      </Panel>
    </div>
  </div>;
}
