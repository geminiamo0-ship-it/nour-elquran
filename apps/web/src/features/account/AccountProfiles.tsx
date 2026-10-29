'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AccountError, accountErrorMessage } from './api';
import { useAccount } from './AccountProvider';
import css from './Account.module.css';

export function SessionControls() {
  const account = useAccount(), [busy, setBusy] = useState(false);
  if (account.state.status !== 'authenticated') return null;
  return <div className={css.actions}>
    <span className={css.hint}>{account.state.session.phoneVerified ? 'تم تأكيد رقم الموبايل' : 'رقم الموبايل لم يُؤكَّد بعد'}</span>
    <button id="account-logout" className={`${css.button} ${css.secondary}`} type="button" disabled={busy}
      onClick={async () => { setBusy(true); try { await account.logout(); } catch { /* Provider clears private views and shows the failure. */ } finally { setBusy(false); } }}>تسجيل الخروج</button>
  </div>;
}

export function AccountProfiles({ selectedId, onSelect }: { selectedId?: string; onSelect?: (id: string) => void }) {
  const account = useAccount(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false), lock = useRef(false);
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  useEffect(() => {
    if (pendingSelection && account.state.status === 'authenticated' && account.state.learners.some(row => row.id === pendingSelection)) {
      onSelect?.(pendingSelection); setPendingSelection(null);
    }
  }, [account.state, pendingSelection, onSelect]);
  if (account.state.status !== 'authenticated') return null;
  const { learners } = account.state;
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (lock.current || uncertain || !form.reportValidity()) return;
    lock.current = true; setBusy(true); setError('');
    const data = new FormData(form);
    try {
      const learner = await account.createLearner({ name: String(data.get('name') ?? '').trim(),
        learnerType: data.get('learnerType') === 'adult' ? 'adult' : 'child' });
      form.reset(); setPendingSelection(learner.id);
    } catch (failure) {
      setError(accountErrorMessage(failure));
      // Do not blindly resend an insertion whose response may have been lost.
      if (!(failure instanceof AccountError) || failure.status === 0 || failure.status >= 500) setUncertain(true);
    } finally { lock.current = false; setBusy(false); }
  }
  return <section className={css.card} aria-labelledby="account-profiles-heading">
    <h2 id="account-profiles-heading">ملفات الطلاب</h2>
    <p>كل طالب له ملف مستقل داخل نفس الحساب. لديك {learners.length} من 8 ملفات.</p>
    {learners.length > 0 ? <ul className={css.list}>{learners.map(learner => <li className={css.row} key={learner.id}>
      <strong>{learner.name}</strong><span>{learner.learnerType === 'child' ? 'طفل / فرد من الأسرة' : 'طالب بالغ'}</span>
      {onSelect && <button type="button" className={`${css.button} ${css.secondary}`} aria-pressed={selectedId === learner.id}
        onClick={() => onSelect(learner.id)}>{selectedId === learner.id ? 'الملف الحالي' : 'اختيار'}</button>}
    </li>)}</ul> : <p>حسابك جاهز. أضف أول طالب لفتح لوحة التعلم.</p>}
    <form className={css.form} onSubmit={add} id="create-learner-form">
      <label htmlFor="new-account-learner">اسم الطالب<input id="new-account-learner" name="name" required maxLength={50} autoComplete="off" /></label>
      <label htmlFor="new-account-type">نوع الملف<select id="new-account-type" name="learnerType" defaultValue="child"><option value="child">طفل / فرد من الأسرة</option><option value="adult">بالغ</option></select></label>
      <button type="submit" className={css.button} disabled={busy || uncertain || learners.length >= 8}>{busy ? 'جارٍ الحفظ…' : 'أضف ملف الطالب'}</button>
    </form>
    {error && <p role="alert" className={css.error}>{error}</p>}
    {uncertain && <button type="button" className={`${css.button} ${css.secondary}`} onClick={() => { void account.refresh(); }}>حدّث القائمة للتحقق قبل إعادة الإضافة</button>}
    <p className={css.hint}>الحصص والتدريبات والتقارير ستظهر عند ربط خدماتها. لا يتم إنشاء حجوزات أو اشتراكات هنا.</p>
  </section>;
}
