'use client';

import { useState } from 'react';
import { useStudent } from '../StudentContext';
import { isValidPreference, mayPreviewFirstTrial, TRIAL_DURATION_MIN, TRIAL_PRICE_EGP,
  type RequestedSlotPreference, type TimePreference } from '../booking';
import styles from '../StudentPortal.module.css';
import sheet from './BookingWorkspace.module.css';

const weekdays=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const windows:Record<TimePreference,string> = {
  morning:'الفترة الصباحية',afternoon:'فترة بعد الظهر',evening:'الفترة المسائية',
};
export function BookingWorkspace() {
  const { selected }=useStudent();
  const [weekday,setWeekday] = useState(6);
  const [window,setWindow] = useState<TimePreference>('evening');
  const [trialPreview,setTrialPreview]=useState<RequestedSlotPreference | null>(null);
  const [weeklyDays,setWeeklyDays]=useState<number[]>([]);
  const [weeklyPreview,setWeeklyPreview]=useState(false);
  const trial=selected.lessons.find((item)=>item.kind === 'trial' && item.status === 'booked');
  const canPreview=mayPreviewFirstTrial(selected.profile.stage);
  function reviewTrial() {
    const request={weekday,window};
    if (canPreview && isValidPreference(request)) setTrialPreview(request);
  }
  function toggleDay(day:number) {
    setWeeklyDays((old)=>old.includes(day)?old.filter((d)=>d!==day):[...old,day].sort());
    setWeeklyPreview(false);
  }
  return <section className={styles.panel} id="trial-booking" aria-labelledby="trial-booking-title">
    <div className={styles.panelHead}><div><p className={styles.eyebrow}>بداية الرحلة بعد إنشاء ملف الطالب</p>
      <h2 id="trial-booking-title">التجربة المجانية والجدول المنتظم</h2></div>
      <span className={styles.statusNeutral}>تصميم تفاعلي غير متصل بالحجز</span></div>
    <div className={sheet.trialIntro}>
      <strong>حصة تجريبية مجانية</strong>
      <div className={sheet.benefits}><span>{TRIAL_DURATION_MIN} دقيقة</span><span>{TRIAL_PRICE_EGP} جنيه</span><span>مرة واحدة لكل طالب مؤهل</span></div>
      <p>بعد تفعيل الحجز الحقيقي، تختار من المواعيد المتاحة فعلًا ويُسند لك شيخ مؤهل تلقائيًا. لا توجد مواعيد مؤكدة أو شيخ معيّن من هذه الواجهة.</p>
    </div>
    {canPreview ? <>
      <p className={styles.panelIntro}>اختر تفضيلًا لليوم والفترة؛ الاختيار ليس موعدًا متاحًا أو حجزًا فعليًا. أهلية التجربة لا تُؤكد إلا على الخادم.</p>
      <div className={sheet.fields}>
        <label htmlFor="trial-weekday">اليوم المفضل</label>
        <select id="trial-weekday" className={styles.selectField} value={weekday}
          onChange={(event)=>{setWeekday(Number(event.target.value));setTrialPreview(null);}}>
          {weekdays.map((day,index)=><option key={day} value={index}>{day}</option>)}
        </select>
        <label htmlFor="trial-window">الفترة المفضلة</label>
        <select id="trial-window" className={styles.selectField} value={window}
          onChange={(event)=>{setWindow(event.target.value as TimePreference);setTrialPreview(null);}}>
          {(Object.keys(windows) as TimePreference[]).map((key)=><option key={key} value={key}>{windows[key]}</option>)}
        </select>
      </div>
      <div className={styles.actionRow}><span className={styles.muted}>لا نجمع رقم بطاقة أو مبلغًا للتجربة.</span>
        <button type="button" className={styles.actionButton} onClick={reviewTrial}>راجع طلب التجربة</button></div>
      {trialPreview && <div role="status" className={sheet.preview}>
        <h3>معاينة طلب حصة تجريبية</h3>
        <p><strong>الطالب:</strong> {selected.profile.name}</p>
        <p><strong>الموعد المفضل:</strong> {weekdays[trialPreview.weekday]} — {windows[trialPreview.window]}</p>
        <p><strong>المدة والتكلفة:</strong> 30 دقيقة، مجانًا تمامًا.</p>
        <p><strong>الشيخ:</strong> يُعيَّن تلقائيًا بعد تحقق الأهلية والتوافر الحقيقي.</p>
        <p>لا يوجد موعد تم حجزه أو إرسال الطلب للأكاديمية؛ دي معاينة فقط.</p>
        <button className={styles.actionButton} type="button" disabled>تأكيد الحجز غير متاح قبل ربط الخدمة</button>
      </div>}
    </> : <div className={styles.emptyBox}>
      {trial ? <>
        <strong>حصة تجريبية مدرجة كمثال</strong>
        <p>الموعد المعروض في الجدول: {trial.dayOffset === 0 ? 'اليوم' : 'بعد ' + trial.dayOffset + ' يوم'}، الساعة {trial.time}.</p>
        <p>دي بيانات وهمية توضيحية، مش حجزًا مؤكدًا أو تعيين شيخ.</p>
      </> : <p>حالة الطالب الحالية لا تسمح بعرض طلب تجربة أولى إضافية. التأكد من الأهلية الفعلية يحتاج سجل تجارب الطالب وصلاحيات الحساب.</p>}
      <p className={sheet.guideline}>إعادة جدولة الحصة المؤكدة متاحة ذاتيًا قبل الموعد بست ساعات على الأقل؛ بعد ذلك تحتاج موافقة الإدارة. توقيت الحصة الحقيقي يجب أن يأتي من النظام.</p>
    </div>}
    <div className={sheet.separation} />
    <div className={styles.panelHead}><div><p className={styles.eyebrow}>بعد الاشتراك المدفوع</p>
      <h2>أيام حصصي الأسبوعية</h2></div></div>
    <p className={styles.panelIntro}>اختيار الأيام المتكررة لا يعني حجزها. لازم نتحقق من الباقة، رصيد الحصص والشيخ الأساسي وتوافر كل موعد على الخادم أولًا.</p>
    <div className={sheet.days} role="group" aria-label="اختر أيام الجدول الأسبوعي المفضل">
      {weekdays.map((day,index)=><button key={day} type="button" aria-pressed={weeklyDays.includes(index)}
        className={weeklyDays.includes(index)?sheet.daySelected:sheet.day}
        onClick={()=>toggleDay(index)}>{day}</button>)}
    </div>
    <div className={styles.actionRow}>
      <span className={styles.muted}>اختياراتك لا تُحفظ في اشتراك فعلي.</span>
      <button type="button" className={styles.actionButton} disabled={weeklyDays.length===0}
        onClick={()=>setWeeklyPreview(true)}>راجع تفضيلات الجدول</button>
    </div>
    {weeklyPreview && <div role="status" className={sheet.preview}>
      <h3>تفضيلات أسبوعية فقط</h3><p>{weeklyDays.map((day)=>weekdays[day]).join('، ')}</p>
      <p>لا توجد حصص تم حجزها أو خصمها. تأكيد كل موعد ينتظر توافر المعلم والرصيد الحقيقي وموافقة الحساب.</p>
    </div>}
  </section>;
}
