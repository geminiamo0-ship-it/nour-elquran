'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useLandingDemo } from './LandingDemoProvider';

type Sibling = { id: number; name: string };
type LearnerType = 'child' | 'self';

/** Client-only demonstration: phone/email never leave the form or enter app state. */
export function Enrollment() {
  const { start } = useLandingDemo();
  const [learnerType, setLearnerType] = useState<LearnerType>('child');
  const [siblings, setSiblings] = useState<Sibling[]>([]);
  const nextId = useRef(0);

  function addSibling() {
    nextId.current += 1;
    setSiblings((current) => [...current, { id: nextId.current, name: '' }]);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const accountName = String(data.get('accountName') ?? '').trim();
    const firstLearner = String(data.get('learnerName') ?? '').trim();
    if (!accountName || !firstLearner) return;
    const learners = [...new Set([firstLearner, ...(learnerType === 'child' ? siblings.map((s) => s.name.trim()) : [])].filter(Boolean))];
    start({ accountName, learners });
  }

  return (
    <section className="enroll simplified-enroll" id="enroll">
      <div className="container">
        <div className="enroll-title"><span className="eyebrow">البِدَايَةُ مِنْ هُنَا</span></div>
        <form className="registration-shell" id="registrationForm" onSubmit={submit}>
          <h3>ابدأ رحلتك القرآنية</h3>
          <p className="sub">تجربة تسجيل تفاعلية — ستظهر لوحة الطالب بعد الإكمال مباشرة.</p>
          <div className="fields">
            <div className="field">
              <label htmlFor="accountName">اسم صاحب الحساب <span className="required-mark" aria-hidden="true">*</span></label>
              <input id="accountName" name="accountName" autoComplete="name" required maxLength={60} placeholder="الاسم الذي سنناديك به" />
            </div>
            <div className="field">
              <label htmlFor="parentPhone">{learnerType === 'child' ? 'رقم موبايل ولي الأمر' : 'رقم الموبايل'} <span className="required-mark" aria-hidden="true">*</span></label>
              <input id="parentPhone" name="parentPhone" type="tel" autoComplete="tel" inputMode="tel" required minLength={11} maxLength={13} pattern="(?:01[0125][0-9]{8}|\\+201[0125][0-9]{8})" title="رقم موبايل مصري صحيح يبدأ بـ 01 أو +20" placeholder="01xxxxxxxxx" dir="ltr" aria-describedby="phoneHelp" />
            </div>
          </div>
          <div className="field full" style={{ marginTop: 14 }}>
            <label htmlFor="accountContact">البريد الإلكتروني <span className="optional-mark">(اختياري للمعاينة)</span></label>
            <input id="accountContact" name="accountContact" type="email" autoComplete="email" maxLength={80} placeholder="example@mail.com" dir="ltr" />
            <span className="input-hint" id="phoneHelp">رقم التواصل أساسي لتأكيد الحصص والتواصل مع ولي الأمر لاحقًا. لن نرسل أي رسالة من هذه النسخة التجريبية.</span>
          </div>
          <fieldset className="field" style={{ marginTop: 15, border: 0, padding: 0 }}>
            <legend>لمن تريد إنشاء ملف طالب؟</legend>
            <div className="audience-selector">
              <label><input type="radio" name="learnerType" value="child" checked={learnerType === 'child'} onChange={() => setLearnerType('child')} /> لطفلي / لأحد أفراد الأسرة</label>
              <label><input type="radio" name="learnerType" value="self" checked={learnerType === 'self'} onChange={() => setLearnerType('self')} /> لنفسي</label>
            </div>
          </fieldset>
          <div className="fields">
            <div className="field">
              <label htmlFor="learnerName">{learnerType === 'child' ? 'اسم الطفل الأول' : 'اسم الطالب'}</label>
              <input id="learnerName" name="learnerName" required maxLength={50} placeholder="اسم الطالب" />
            </div>
            <div className="field">
              <label htmlFor="learnerLevel">المستوى التقريبي</label>
              <select id="learnerLevel" name="learnerLevel" required defaultValue="">
                <option value="" disabled>اختر المستوى</option>
                <option>يبدأ من الصفر</option><option>يقرأ ويحتاج تصحيحًا</option>
                <option>يحفظ بعض السور</option><option>يريد المراجعة والتثبيت</option>
              </select>
            </div>
          </div>
          {learnerType === 'child' && (
            <div id="siblingsArea">
              <div className="sibling-list" id="siblingList">
                {siblings.map((sibling) => (
                  <div className="sibling-field" key={sibling.id}>
                    <input aria-label="اسم الطفل الإضافي" placeholder="اسم الطفل الآخر" maxLength={50} value={sibling.name} onChange={(event) => setSiblings((current) => current.map((s) => s.id === sibling.id ? { ...s, name: event.target.value } : s))} />
                    <button type="button" onClick={() => setSiblings((current) => current.filter((s) => s.id !== sibling.id))}>حذف</button>
                  </div>
                ))}
              </div>
              <button type="button" className="add-sibling" id="addSiblingBtn" onClick={addSibling}>+ إضافة طفل آخر لنفس الحساب</button>
            </div>
          )}
          <button type="submit" className="btn btn-gold" style={{ marginTop: 20, width: '100%' }}>إنشاء حساب تجريبي وفتح لوحة الطالب ↖</button>
          <p className="form-note">لا توجد كلمة مرور أو رمز تحقق في هذا الـMock. الربط الآمن مع Supabase Auth يأتي في مرحلة الـBackend.</p>
        </form>
      </div>
    </section>
  );
}
