'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { accountErrorMessage } from './api';
import { useAccount } from './AccountProvider';
import css from './Account.module.css';

export function AccountForm({ initialMode = 'register' }: { initialMode?: 'register' | 'login' }) {
  const account = useAccount(), router = useRouter();
  const [mode, setMode] = useState(initialMode), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (lock.current || !form.reportValidity()) return;
    lock.current = true; setBusy(true); setError('');
    const data = new FormData(form), value = (key: string) => String(data.get(key) ?? '').trim();
    const credentials = { phoneNumber: value('phoneNumber'), password: String(data.get('password') ?? '') };
    let accountCreated = false;
    try {
      if (mode === 'register') {
        await account.register({ ...credentials, name: value('name') });
        accountCreated = true;
        await account.createLearner({ name: value('learnerName'), learnerType: data.get('learnerType') === 'adult' ? 'adult' : 'child' });
      } else { await account.login(credentials); }
      router.push('/student');
    } catch (failure) {
      setError(accountCreated ? 'تم إنشاء الحساب. تعذّر إضافة الطالب؛ افتح لوحة الطالب لإكمال ملفه دون التسجيل مرة أخرى.' : accountErrorMessage(failure));
    } finally {
      const password = form.elements.namedItem('password');
      if (password instanceof HTMLInputElement) password.value = '';
      lock.current = false; setBusy(false);
    }
  }
  if (account.state.status === 'checking') return <div className={css.card} role="status">جارٍ التحقق من الجلسة…</div>;
  if (account.state.status === 'error') return <div className={css.card}>
    <p className={css.error} role="alert">{account.state.message}</p>
    <button type="button" className={css.button} onClick={() => { void account.refresh(); }}>إعادة الاتصال والتحقق من الحساب</button>
    <p className={css.hint}>إذا انقطع الاتصال أثناء التسجيل، سنتحقق من الحساب قبل أي محاولة جديدة.</p>
  </div>;
  if (account.state.status === 'authenticated') return <div className={css.card}>
    <h2>مرحبًا، {account.state.session.user.name}</h2>
    {error && <p className={css.error} role="alert">{error}</p>}
    <p>حسابك مفتوح. يمكنك متابعة ملفات الطلاب من لوحة الطالب.</p>
    <Link className={css.button} href="/student">افتح لوحة الطالب</Link>
  </div>;
  return <div className={css.card}>
    <h2>{mode === 'register' ? 'ابدأ رحلتك القرآنية' : 'تسجيل الدخول'}</h2>
    <p className={css.hint}>الحساب بالموبايل وكلمة المرور. تأكيد ملكية الرقم واسترجاع كلمة المرور لم يتوفرا بعد؛ لا تُرسل رسائل في هذه المرحلة.</p>
    <form className={css.form} id="account-form" onSubmit={submit}>
      {mode === 'register' && <label htmlFor="auth-name">اسم صاحب الحساب<input id="auth-name" name="name" required maxLength={80} autoComplete="name" /></label>}
      <label htmlFor="auth-phone">رقم الموبايل / ولي الأمر<input id="auth-phone" name="phoneNumber" required type="tel" inputMode="tel" dir="ltr" maxLength={24} autoComplete="tel" placeholder="01xxxxxxxxx أو +201xxxxxxxxx" /></label>
      <label htmlFor="auth-password">كلمة المرور<input id="auth-password" name="password" required type="password" minLength={8} maxLength={128} dir="ltr" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></label>
      {mode === 'register' && <>
        <label htmlFor="auth-learner-type">ملف الطالب الأول<select id="auth-learner-type" name="learnerType" defaultValue="child"><option value="child">لطفلي / لأحد أفراد الأسرة</option><option value="adult">لنفسي</option></select></label>
        <label htmlFor="auth-learner-name">اسم الطالب<input id="auth-learner-name" name="learnerName" required maxLength={50} autoComplete="off" /></label>
        <p className={css.hint}>يمكنك إضافة بقية الطلاب من نفس الحساب بعد الدخول. المستوى والمواعيد تُحدَّد مع الشيخ لاحقًا.</p>
      </>}
      {error && <p className={css.error} role="alert">{error}</p>}
      <button type="submit" className={css.button} disabled={busy}>{busy ? 'جارٍ الإكمال…' : mode === 'register' ? 'إنشاء الحساب وفتح لوحة الطالب' : 'دخول إلى لوحة الطالب'}</button>
    </form>
    <div className={css.actions}><button type="button" className={`${css.button} ${css.secondary}`} disabled={busy}
      id="account-mode-switch" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>
      {mode === 'register' ? 'لديّ حساب — تسجيل الدخول' : 'إنشاء حساب جديد'}</button></div>
  </div>;
}
