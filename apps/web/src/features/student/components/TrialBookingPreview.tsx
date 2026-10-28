'use client';

import { useEffect, useState } from 'react';
import { useStudent } from '../StudentContext';
import {
  changeDeadline, getMockTrialPreviewSlots, isValidTrialPreviewSlot, trialPreviewEligibility,
} from '../trialScheduling';
import styles from '../StudentPortal.module.css';
import css from './TrialBookingPreview.module.css';

const cairoTime = new Intl.DateTimeFormat('ar-EG', {
  timeZone: 'Africa/Cairo', dateStyle: 'full', timeStyle: 'short',
});

export function TrialBookingPreview() {
  const { selected } = useStudent();
  const [now, setNow] = useState<Date | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewedId, setReviewedId] = useState<string | null>(null);
  useEffect(() => setNow(new Date()), []);

  const eligibility = trialPreviewEligibility(selected.profile.stage);
  const slots = now && eligibility === 'eligible'
    ? getMockTrialPreviewSlots(selected.profile.id, now) : [];
  const chosen = slots.find((slot) => slot.id === selectedId) ?? null;
  const reviewed = chosen && reviewedId === chosen.id && now
    && isValidTrialPreviewSlot(chosen, selected.profile.id, now);

  return <section id="trial-preview" className={styles.panel} aria-labelledby="trial-preview-heading">
    <div className={styles.panelHead}>
      <div><p className={styles.eyebrow}>الحجز بعد إنشاء ملف الطالب</p>
        <h2 id="trial-preview-heading">استكشف الحصة التجريبية</h2></div>
      <span className={styles.statusNeutral}>معاينة محلية فقط</span>
    </div>
    <p className={styles.panelIntro}>مدة الحصة التجريبية 30 دقيقة، مرة واحدة لكل طالب بعد التحقق من أهليته.
      لا توجد مواعيد حقيقية متاحة هنا، ولم يتم تعيين شيخ أو الاتصال بنظام الحجز.</p>
    {eligibility !== 'eligible' ? <div className={styles.infoNote}>
      {eligibility === 'used'
        ? 'هذا الملف في حالة حصة تجريبية محجوزة أو تم تقييمها (بيانات مثال). لا يمكن إنشاء تجربة ثانية من هذه المعاينة.'
        : 'هذا الملف ليس في مرحلة حجز التجربة الأولى. اعرض الجدول الحالي أو تواصل مع الإدارة عند تشغيل الخدمة.'}
    </div> : !now ? <p role="status" className={css.note}>جارٍ إعداد أمثلة المواعيد…</p>
      : slots.length === 0 ? <div role="status" className={styles.emptyBox}>
        لا توجد أمثلة مواعيد صالحة الآن. لا يمكن تقديم طلب حجز.
      </div> : <>
        <div role="group" aria-label="اختر موعدًا توضيحيًا" className={css.choices}>
          {slots.map((slot) => <button type="button" key={slot.id} data-preview-slot
            className={css.slot} aria-pressed={selectedId === slot.id}
            onClick={() => { setSelectedId(slot.id); setReviewedId(null); }}>
            <strong>{cairoTime.format(new Date(slot.startsAt))}</strong>
            <small>30 دقيقة · مثال غير متاح للحجز</small>
          </button>)}
        </div>
        <button id="trial-review-button" type="button" className={css.reviewButton}
          disabled={!chosen} onClick={() => setReviewedId(chosen?.id ?? null)}>
          مراجعة الموعد المختار
        </button>
        {reviewed && chosen && <div id="trial-review-summary" role="status" className={css.summary}>
          <strong>ملخص اختيار توضيحي — ليس حجزًا</strong>
          <p>الطالب: {selected.profile.name}</p>
          <p>الموعد: {cairoTime.format(new Date(chosen.startsAt))}، لمدة 30 دقيقة.</p>
          <p>الشيخ: لم يتم تعيين شيخ؛ يتطلب الحجز الفعلي مطابقة التخصص والتوفر.</p>
          <p>آخر موعد نظري لطلب تغيير الحصة: {cairoTime.format(changeDeadline(chosen.startsAt)!)},
            أي قبل البداية بست ساعات على الأقل. يجب إعادة التحقق من السياسة على الخادم.</p>
          <button id="trial-submit-disabled" className={css.disabled} type="button" disabled>
            تأكيد الحجز غير متاح
          </button>
        </div>}
      </>}
    <p className={css.note}>في النظام الفعلي: يراجع الخادم أهلية الطالب وتوفر الشيخ ويمنع الحجز المزدوج،
      ثم يؤكد الحصة بمعاملة موثقة. اختيارك هنا لا يُحفظ ولا يُرسل.</p>
    <p className={styles.panelFoot}>الجدول الأسبوعي وتغيير المواعيد يحتاجان حجزًا فعليًا؛ لا يُستبدل موعد قائم
      إلا بعد نجاح المعاملة، ولا توجد خصومات أو حجوزات في هذه المعاينة.</p>
  </section>;
}
