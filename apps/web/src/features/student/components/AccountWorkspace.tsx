'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useStudent } from '../StudentContext';
import { MAX_SIBLINGS } from '../domain';
import { ACCOUNT_UI_ENABLED, AccountProfiles } from '@/features/account';
import styles from '../StudentPortal.module.css';

export function AccountWorkspace() {
  const { selectedId, selectLearner } = useStudent();
  return ACCOUNT_UI_ENABLED ? <AccountProfiles selectedId={selectedId} onSelect={selectLearner} /> : <DemoAccountWorkspace />;
}
function DemoAccountWorkspace() {
  const { learners, selectedId, selectLearner, createDemoLearner, removeDemoLearner } = useStudent();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState('');
  const sessionProfiles = learners.filter((item) => item.id.startsWith('session-learner-'));
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createDemoLearner(name)) { setError('الاسم مطلوب، غير مكرر، ولا يزيد عن 50 حرفًا؛ بحد أقصى 8 ملفات للتجربة.'); return; }
    setName(''); setError('');
  }
  function remove() {
    if (removing && removeDemoLearner(removing)) setRemoving('');
  }
  return <div className={styles.workspace}>
    <section className={styles.panel}>
      <div className={styles.panelHead}><div><p className={styles.eyebrow}>الحساب الواحد</p><h2>ملفات الطلاب</h2></div>
        <span className={styles.statusNeutral}>{sessionProfiles.length} ملفات أُنشئت في المعاينة</span></div>
      <p className={styles.panelIntro}>لا توجد لوحة منفصلة لولي الأمر. اختر الطالب من نفس الحساب، وكل جدول وواجب وتقرير مرتبط بملفه فقط. الأسماء هنا داخل جلسة المتصفح وليست حسابات حقيقية.</p>
      <div className={styles.stack}>{learners.map((learner) =>
        <article className={styles.profileItem} key={learner.id}>
          <div><strong>{learner.name}</strong>
            <small>{learner.id.startsWith('session-learner-') ? 'ملف أُضيف في جلسة التجربة' : 'شخصية افتراضية لعرض التصميم'}</small></div>
          <div className={styles.actionRow}>
            <button type="button" className={selectedId === learner.id ? styles.filterActive : styles.filterButton}
              aria-pressed={selectedId === learner.id} onClick={() => selectLearner(learner.id)}>
              {selectedId === learner.id ? 'الملف الحالي' : 'اختيار'}</button>
            {learner.id.startsWith('session-learner-') &&
              <button type="button" className={styles.textButton} onClick={() => setRemoving(learner.id)}>حذف</button>}
          </div>
        </article>)}</div>
      {removing && <div className={styles.infoNote} role="alertdialog" aria-label="تأكيد حذف الملف التجريبي">
        هل تريد حذف هذا الملف التجريبي من جلسة المتصفح؟ ستُمسح ملاحظاته المحلية.
        <div className={styles.actionRow}><button type="button" className={styles.filterButton} onClick={() => setRemoving('')}>تراجع</button>
          <button type="button" className={styles.actionButton} onClick={remove}>تأكيد الحذف</button></div>
      </div>}
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHead}><div><p className={styles.eyebrow}>إضافة فرد للأسرة</p><h2>إنشاء ملف تجريبي</h2></div></div>
      <form onSubmit={add} className={styles.formCard}>
        <label htmlFor="new-learner" className={styles.formLabel}>اسم الطالب</label>
        <input id="new-learner" className={styles.selectField} autoComplete="off" maxLength={50}
          value={name} onChange={(event) => setName(event.target.value)} placeholder="الاسم في معاينة المتصفح" />
        <div className={styles.actionRow}><span className={styles.muted}>حتى {MAX_SIBLINGS} ملفات مضافة</span>
          <button type="submit" className={styles.actionButton}>أضف ملف الطالب</button></div>
        {error && <p role="alert" className={styles.formError}>{error}</p>}
      </form>
      <p className={styles.panelFoot}>تأكيد ولي الأمر والهاتف وصلاحيات إضافة الأطفال والاشتراكات قيد التطوير في نظام الحسابات الحقيقي.</p>
    </section>
    <Link href="/" className={styles.outlineButton}>العودة إلى نور القرآن</Link>
  </div>;
}

