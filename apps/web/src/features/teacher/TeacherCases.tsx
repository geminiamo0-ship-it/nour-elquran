'use client';
import {useTeacher} from './TeacherContext';
import {canReportStudentAbsent,hasTeacherDelayEscalation,shouldWarnOvertime} from './domain';
import {Empty,Panel,Pill,SectionHeading} from './TeacherUI';
import styles from './TeacherPortal.module.css';
export function TeacherCases(){
  const {lessons,learners,incidents,reportNoShow}=useTeacher();
  return <div>
    <SectionHeading eyebrow="الحضور والمسؤولية" title="الحضور والمتابعة" description="توثيق التأخير والانقطاع والغياب؛ أي تعويض أو خصم يخضع للتحقق والقرار الإداري، وليس لحالة اتصال المتصفح."/>
    <div className={styles.policyGrid}>
      <div><strong>٥ دقائق</strong><span>تنبيه الإدارة لتأخر الشيخ</span></div>
      <div><strong>١٠ دقائق</strong><span>تصعيد تأخر الشيخ وحق الطالب في طلب المساعدة</span></div>
      <div><strong>١٥ دقيقة</strong><span>يجوز للشيخ تقديم بلاغ غياب طالب مبدئي</span></div>
      <div><strong>٤٠ دقيقة</strong><span>مدة الحجز؛ التنبيه لا ينهي الحصة تلقائيًا</span></div>
    </div>
    <div className={styles.twoColumns}>
      <Panel title="أحداث الحصص">
        {lessons.length?lessons.map(l=><div key={l.id} className={styles.attendanceRow}>
          <div><b>{learners.find(x=>x.id===l.learnerId)?.name??'الطالب'}</b><small>{l.day} · {l.startsAt} – {l.reservedUntil}</small></div>
          <div className={styles.inlineBadges}>
            <Pill tone={l.teacherPresent?'good':'warning'}>{l.teacherPresent?'الشيخ حاضر':'الشيخ غائب عن الانتظار'}</Pill>
            <Pill tone={l.learnerPresent?'good':'warning'}>{l.learnerPresent?'الطالب حاضر':'الطالب غير متصل'}</Pill>
            {shouldWarnOvertime(l)&&<Pill tone="danger">تعارض محتمل</Pill>}
          </div>
          {canReportStudentAbsent(l)&&<button type="button" className={styles.secondaryButton}
            onClick={()=>reportNoShow(l.id)}>بلاغ عدم حضور مبدئي</button>}
          {hasTeacherDelayEscalation(l)&&<div className={styles.warningNote}>تأخر الشيخ أكثر من ١٠ دقائق؛ للطالب المغادرة وطلب موعد بديل دون اعتباره غائبًا، والإدارة تتحقق أولًا.</div>}
        </div>):<Empty title="لا توجد حصص تحت المتابعة" description="ملفات الحضور الحقيقية تعتمد على السجلات الزمنية الصادرة عن الخادم."/>}
      </Panel>
      <Panel title="سجل الحالات المفتوحة" extra={<Pill tone="warning">{incidents.filter(i=>i.status==='pending').length} معلقة</Pill>}>
        {incidents.length?incidents.map(i=><article className={styles.incidentCard} key={i.id}>
          <div className={styles.rowBetween}><strong>{i.label}</strong><Pill tone={i.status==='pending'?'warning':'good'}>{i.status==='pending'?'للمراجعة الإدارية':'حُسمت'}</Pill></div>
          <p>{i.detail}</p><small>مرجع الحصة: {i.lessonId}</small>
        </article>):<Empty title="لا توجد بلاغات" description="سجل التعويضات والمطالبات لا ينشأ تلقائيًا من انقطاع الإنترنت."/>}
      </Panel>
    </div>
    <Panel title="قواعد اعتماد الحالات">
      <div className={styles.detailList}>
        <p><b>طالب متأخر:</b> عند الدقيقة ١٥ يحق للشيخ رفع بلاغ، ولو حضر الطالب بعدها يمكن البدء مع وجود الاثنين دون إذن مسبق.</p>
        <p><b>شيخ متأخر:</b> الطالب يحق له مغادرة الانتظار بعد ١٠ دقائق ورفع طلب تعويض؛ الإدارة تحدد المسؤولية.</p>
        <p><b>انقطاع اتصال:</b> إعادة الانضمام لنفس الحصة، مع استعادة ملاحظات الشيخ والعمليات المؤكدة، دون إنهاء تلقائي.</p>
        <p><b>الشيخ البديل:</b> لا يبدأ قبل الموافقة الصريحة لولي الأمر، وصلاحيته التعليمية تنتهي بانتهاء الحصة.</p>
        <p><b>الحصة المنتهية:</b> يظل التقرير في انتظار اعتماد الشيخ، ولا يفسَّر غياب التقرير بأنه غياب عن الحصة.</p>
      </div>
    </Panel>
  </div>;
}
