'use client';
import {useState} from 'react';
import {Empty,SectionHeading} from './TeacherUI';
import {TeacherAcademicPlanEditor} from './TeacherAcademicPlanEditor';
import type {TeacherRosterRow,TeacherCalendarRow} from './teacher-read-api';
import styles from './TeacherPortal.module.css';
import {selectAuthorizedTeacherLearner,currentAuthorizedLearnerLessons} from './connected-teacher-roster';

type Props={
  learners:readonly TeacherRosterRow[];
  lessons:readonly TeacherCalendarRow[];
};
const formatTime=(timestamp:number)=>new Intl.DateTimeFormat('ar-EG',{
  timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short',
}).format(new Date(timestamp));
export function TeacherConnectedStudents({learners,lessons}:Props){
  const [query,setQuery]=useState('');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  // A revoked/expired assignment must immediately disappear from detail view.
  const {shown,selected}=selectAuthorizedTeacherLearner(learners,query,selectedId);
  const allowedLessons=currentAuthorizedLearnerLessons(selected,lessons);
  const upcoming=allowedLessons.filter(item=>['scheduled','live'].includes(item.status)&&item.endsAtMs>Date.now())
    .sort((a,b)=>a.startsAtMs-b.startsAtMs);
  return <div>
    <SectionHeading eyebrow="المتابعة الأكاديمية" title="طلابي"
      description="الطلاب المسندون إليك حاليًا فقط. خطط الحفظ والمراجعة محفوظة في Cloudflare D1 ولا تُنشئ واجبات تلقائيًا."/>
    <div className={styles.studentsLayout}>
      <section className={styles.roster} aria-label="قائمة الطلاب المصرح بهم">
        <label className={styles.fieldLabel} htmlFor="connected-student-search">ابحث بين طلابك</label>
        <input id="connected-student-search" className={styles.input} value={query}
          onChange={e=>setQuery(e.target.value)} placeholder="اسم الطالب" autoComplete="off"/>
        <p className={styles.helpText}>الطلاب الحاليون: {learners.length}</p>
        <div className={styles.rosterList}>
          {shown.length?shown.map(item=><button key={item.id} type="button"
            className={selected?.id===item.id?styles.rosterActive:styles.rosterItem}
            aria-pressed={selected?.id===item.id}
            onClick={()=>setSelectedId(item.id)}>
            <span className={styles.studentCircle} aria-hidden="true">{item.name.slice(0,1)}</span>
            <span className={styles.rosterText}><strong>{item.name}</strong>
              <small>{item.learnerType==='child'?'طالب من الأسرة':'طالب بالغ'} · تعيين أساسي نشط</small></span>
            <span aria-hidden="true">‹</span>
          </button>):<Empty title={query?'لا يوجد طالب بهذا الاسم':'لا يوجد طلاب مسندون'}
            description={query?'جرّب البحث باسم آخر.':'ستظهر هنا الملفات بعد إسناد الشيخ الأساسي من إدارة المنصة.'}/>}
        </div>
      </section>
      <section className={styles.studentDetail} aria-live="polite">
        {selected?<><div className={styles.profileHero}>
          <span className={styles.studentCircleLarge} aria-hidden="true">{selected.name.slice(0,1)}</span>
          <div><p className={styles.eyebrow}>الملف الأكاديمي المتصل</p><h2>{selected.name}</h2>
            <p>{selected.learnerType==='child'?'طالب من الأسرة':'طالب بالغ'} · تعيين أساسي مصرح به</p></div>
        </div>
        <TeacherAcademicPlanEditor key={selected.id} learnerId={selected.id} learnerName={selected.name}/>
        <div className={styles.profileHero}>
          <div>
            <p className={styles.eyebrow}>الجدول الفعلي</p>
            <h2>حصص الطالب</h2>
            <p>الحصص المصرح بها: {allowedLessons.length} · القادمة: {upcoming.length}</p>
            {upcoming.slice(0,3).map(item=><p key={item.id}><time dateTime={new Date(item.startsAtMs).toISOString()}>
              {formatTime(item.startsAtMs)}</time> · {item.kind==='trial'?'تجريبية':item.kind==='makeup'?'تعويضية':'أساسية'}</p>)}
            {!upcoming.length&&<p>لا توجد حصة قادمة مسجلة لهذا الطالب.</p>}
          </div>
        </div>
        <p className={styles.helpText}>التقارير والدرجات والواجبات والتسميعات لا تُعرض هنا قبل ربط سجلاتها الحقيقية.
          المصحف الخاص بالطالب وعلاماته الشخصية غير متاحين للشيخ.</p>
        </>:<Empty title="اختر طالبًا" description="ملفات غير المسندين أو المحذوفة من قائمة التعيينات لا تظهر هنا."/>}
      </section>
    </div>
  </div>;
}
