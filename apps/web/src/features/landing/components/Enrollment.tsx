'use client';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Field } from '@/shared/ui';
import styles from '../LandingPage.module.css';

export function Enrollment() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [learners, setLearners] = useState([{ id: 1, name: '', level: 'beginner' }]);
  const [submitted, setSubmitted] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const validPhone = /^\+?[0-9\s()-]{8,20}$/.test(phone.trim());
  const validLearners = learners.every((learner) => learner.name.trim().length > 1);
  const valid = name.trim().length > 1 && validPhone && validLearners;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    if (!valid) return;
    setSubmitted(true);
  }

  return <section id="enroll" className={styles.enroll}>
    <div className={styles.container}>
      <div><span className={styles.eyebrow}>ابدأ اليوم</span><h2>ابدأ رحلتك القرآنية</h2>
        <p>حساب واحد يضم ملفات مستقلة لكل متعلم. بعد إنشاء الحساب الحقيقي لاحقًا، ستكون الحصة التجريبية من داخل لوحة الطالب.</p>
        <Alert>نسخة تجريبية للواجهة فقط: لا يتم إنشاء حساب أو إرسال رقم الهاتف أو حفظ بياناتك على خادم.</Alert>
      </div>
      <form className={styles.form} onSubmit={submit} noValidate>
        <Field id="account-name" label="اسم صاحب الحساب" autoComplete="name" required value={name}
          onChange={(event) => setName(event.target.value)}
          error={attempted && name.trim().length < 2 ? 'أدخل اسمًا من حرفين على الأقل' : undefined} />
        <Field id="guardian-phone" label="رقم هاتف ولي الأمر أو المتعلم البالغ" type="tel" inputMode="tel" autoComplete="tel" required value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={attempted && !validPhone ? 'أدخل رقم هاتف صالحًا' : undefined} />
        {learners.map((learner, index) => <div className={styles.learner} key={learner.id}>
          <strong>المتعلم {index + 1}</strong>
          <Field id={`learner-${learner.id}`} label="اسم المتعلم" required value={learner.name}
            onChange={(event) => setLearners((items) => items.map((item) => item.id === learner.id ? { ...item, name: event.target.value } : item))}
            error={attempted && learner.name.trim().length < 2 ? 'أدخل اسم المتعلم' : undefined} />
          <label htmlFor={`level-${learner.id}`}>المستوى التقريبي</label>
          <select id={`level-${learner.id}`} value={learner.level}
            onChange={(event) => setLearners((items) => items.map((item) => item.id === learner.id ? { ...item, level: event.target.value } : item))}>
            <option value="beginner">مبتدئ</option><option value="intermediate">متوسط</option><option value="advanced">متقدم</option>
          </select>
          {learners.length > 1 && <button type="button" className={styles.textButton}
            onClick={() => setLearners((items) => items.filter((item) => item.id !== learner.id))}>حذف هذا المتعلم</button>}
        </div>)}
        <button type="button" className={styles.textButton}
          onClick={() => setLearners((items) => [...items, { id: Math.max(...items.map((item) => item.id)) + 1, name: '', level: 'beginner' }])}>
          + إضافة متعلم آخر
        </button>
        <Button type="submit">متابعة التسجيل التجريبي</Button>
        {submitted && <Alert tone="success">النموذج صالح للعرض التجريبي. إنشاء الحساب ولوحة الطالب سيتم ربطهما في مرحلة لاحقة، ولم تُرسل أي بيانات.</Alert>}
      </form>
    </div>
  </section>;
}
