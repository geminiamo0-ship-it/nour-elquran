'use client';
import {useState} from 'react';
import {useTeacher} from './TeacherContext';
import {canStartLesson} from './domain';
import {Empty,Panel,Pill,SectionHeading} from './TeacherUI';
import styles from './TeacherPortal.module.css';

export function TeacherPreparation(){
  const {learners,lessons,reports,assignments,selectedLessonId,setSelectedLessonId}=useTeacher();
  const [privateScratch,setPrivateScratch]=useState<Record<string,string>>({});
  const available=lessons.filter(l=>l.status!=='cancelled');
  const lesson=available.find(l=>l.id===selectedLessonId)??available.find(l=>l.status==='waiting'||l.status==='scheduled')??available[0]??null;
  const learner=learners.find(l=>l.id===lesson?.learnerId);
  const substitute=lesson?.isSubstitute??false;
  const prior=reports.find(r=>r.learnerId===learner?.id&&r.status==='published');
  const tasks=assignments.filter(a=>a.learnerId===learner?.id);
  return <div>
    <SectionHeading eyebrow="قبل الدخول للفصل" title="تحضير الحصة" description="معلومات عملية أمام الشيخ: الورد والمراجعة وآخر أخطاء موثقة، دون إظهار ملاحظات الطالب الخاصة."/>
    <label className={styles.fieldLabel} htmlFor="prep-lesson">الحصة المطلوب تحضيرها</label>
    <select id="prep-lesson" className={styles.selectWide} value={lesson?.id??''} onChange={e=>setSelectedLessonId(e.target.value)}>
      {!available.length&&<option value="">لا توجد حصص</option>}
      {available.map(l=><option key={l.id} value={l.id}>{learners.find(x=>x.id===l.learnerId)?.name??'طالب'} · {l.day} {l.startsAt}{l.isSubstitute?' · بديل':''}</option>)}
    </select>
    {!lesson||!learner?<Empty title="لا توجد حصة تستحق التحضير" description="تظهر خطة التحضير بعد إسناد الطالب وموعد مؤكد من نظام الحجوزات."/>:<>
      <div className={styles.prepHero}>
        <div><span className={styles.eyebrow}>جلسة تحفيظ · بيانات العرض</span><h2>{learner.name}</h2>
          <p>{lesson.day} · {lesson.startsAt} — {lesson.reservedUntil} · {learner.level}</p></div>
        {substitute?<Pill tone="blue">ملخص بديل محدود</Pill>:<Pill tone="good">معلم الطالب الأساسي</Pill>}
      </div>
      {substitute&&<div className={styles.warningNote}>هذه حصة بديلة بموافقة ولي الأمر. يُتاح للبديل الحد الأدنى من الورد والملاحظات اللازمة فقط، وتنتهي صلاحية هذا الملخص عند إنهاء الحصة.</div>}
      <div className={styles.twoColumns}>
        <Panel title="خطة الحصة القادمة">
          <div className={styles.prepItem}><span>٠١ · الورد الجديد</span><strong>{learner.nextWird}</strong></div>
          <div className={styles.prepItem}><span>٠٢ · المراجعة</span><strong>{learner.revision}</strong></div>
          <div className={styles.prepItem}><span>٠٣ · موضوع التركيز</span><strong>{learner.focus}</strong></div>
        </Panel>
        <Panel title="المراجعة السابقة">
          {substitute?<p>الملخص المختصر: {learner.focus}. لا تتوفر الدرجات أو التقارير التاريخية للشيخ البديل.</p>:
          prior?<><p><b>النطاق السابق:</b> {prior.scope}</p><p><b>نقطة التحسين:</b> {prior.corrections}</p>
            <p className={styles.helpText}>المصدر: آخر تقرير معتمد، وليس ملاحظات أو درجات غير منشورة.</p></>:
          <Empty title="لا يوجد تقرير معتمد سابق" description="لن نخترع ملخصًا أو نتيجة تقييم من مسودة غير منشورة."/>}
        </Panel>
        {!substitute&&<Panel title="الواجبات السابقة">
          {tasks.length?tasks.map(t=><div key={t.id} className={styles.detailRow}><b>سورة {t.surahName}</b> · الآيات {t.fromAyah}–{t.toAyah}<p>الحالة: {t.status==='awaiting-review'?'يحتاج مراجعة':t.status==='completed'?'مكتمل':'قيد العمل'}</p></div>):
          <Empty title="لا يوجد واجب سابق" description="الواجبات الجديدة تنشر لاحقًا من نموذج الواجبات."/>}
        </Panel>}
        <Panel title="ملاحظات الشيخ قبل الفصل" >
          <label className={styles.fieldLabel} htmlFor="prep-private">مسودة خاصة بالحصة</label>
          <textarea className={styles.textarea} id="prep-private" rows={5} maxLength={800}
            value={privateScratch[lesson.id]??''} onChange={e=>setPrivateScratch(prev=>({...prev,[lesson.id]:e.target.value}))}
            placeholder="مواضع التسميع، مراجعة الأخطاء، أسئلة للطالب..."/>
          <p className={styles.helpText}>مسودة مؤقتة في ذاكرة الصفحة؛ لا يراها الطالب ولا تُرسل للخادم أو تُنشر تلقائيًا.</p>
        </Panel>
      </div>
      <div className={styles.prepFooter}><div><b>جاهزية الفصل</b><p>الشيخ {lesson.teacherPresent?'موجود':'غير متصل'} · الطالب {lesson.learnerPresent?'موجود':'غير متصل'}.</p></div>
        <button className={styles.primaryButton} type="button" disabled
          title="خادم الحضور وغرفة الاتصال لم يتم ربطهما بعد">
          {canStartLesson(lesson)?'بدء الحصة · بعد تفعيل الفصل':'في انتظار الطرفين'}
        </button>
      </div>
    </>}
  </div>;
}
