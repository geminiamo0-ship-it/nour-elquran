'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AccountError, accountErrorMessage, type AccountLearner } from './api';
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
  const [editingId,setEditingId]=useState<string|null>(null);
  const [archiveId,setArchiveId]=useState<string|null>(null);
  const [actionBusy,setActionBusy]=useState(false);
  const [actionError,setActionError]=useState('');
  const [actionUncertain,setActionUncertain]=useState(false);
  const actionLock=useRef(false);
  async function changeProfile(learner:AccountLearner, action:'rename'|'archive', name?:string) {
    if(actionLock.current || actionUncertain)return;
    if(document.querySelector('[data-quran-save-status="pending"],[data-quran-save-status="failed"]')){
      setActionError('أكمل حفظ المصحف قبل تغيير ملف الطالب.');return;
    }
    const normalized=name?.trim();
    if(action==='rename' && (!normalized || normalized.length>50)){
      setActionError('الاسم مطلوب، وبحد أقصى 50 حرفًا.');return;
    }
    if(action==='rename' && normalized===learner.name){setEditingId(null);return;}
    actionLock.current=true;setActionBusy(true);setActionError('');
    try {
      const operationId=crypto.randomUUID();
      await account.profileAction(learner.id,action==='rename'
        ? {action,operationId,expectedRevision:learner.revision,name:normalized!}
        : {action,operationId,expectedRevision:learner.revision});
      setEditingId(null);setArchiveId(null);
    }catch(failure){
      setActionError(accountErrorMessage(failure));
      if(!(failure instanceof AccountError) || failure.status===0 || failure.status>=500)
        setActionUncertain(true);
    }finally{actionLock.current=false;setActionBusy(false);}
  }
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
        disabled={actionBusy || actionUncertain}
        onClick={() => onSelect(learner.id)}>{selectedId === learner.id ? 'الملف الحالي' : 'اختيار'}</button>}
      <button type="button" className={`${css.button} ${css.secondary}`} disabled={actionBusy || actionUncertain}
        aria-expanded={editingId===learner.id} aria-controls={'rename-profile-'+learner.id}
        onClick={()=>{setEditingId(editingId===learner.id?null:learner.id);setArchiveId(null);setActionError('');}}>
        تعديل الاسم</button>
      <button type="button" className={`${css.button} ${css.secondary}`} disabled={actionBusy || actionUncertain}
        aria-expanded={archiveId===learner.id} aria-controls={'archive-profile-'+learner.id}
        onClick={()=>{setArchiveId(archiveId===learner.id?null:learner.id);setEditingId(null);setActionError('');}}>
        أرشفة الملف</button>
      {editingId===learner.id&&<form id={'rename-profile-'+learner.id} className={css.form}
        onSubmit={e=>{e.preventDefault();const field=new FormData(e.currentTarget).get('profileName');
          void changeProfile(learner,'rename',String(field??''));}}>
        <label htmlFor={'profile-name-'+learner.id}>اسم الطالب الجديد
          <input id={'profile-name-'+learner.id} name="profileName" required maxLength={50}
            defaultValue={learner.name} autoComplete="off" disabled={actionBusy}/></label>
        <div className={css.actions}><button className={css.button} type="submit" disabled={actionBusy}>
          {actionBusy?'جارٍ الحفظ…':'حفظ الاسم'}</button>
          <button className={`${css.button} ${css.secondary}`} type="button" disabled={actionBusy}
            onClick={()=>setEditingId(null)}>إلغاء</button></div>
      </form>}
      {archiveId===learner.id&&<div id={'archive-profile-'+learner.id} role="group" aria-label={'تأكيد أرشفة '+learner.name}>
        <p>ستُخفى صفحة هذا الطالب من الملفات النشطة، مع الاحتفاظ بتاريخ حصصه وملاحظاته. لن يتم حذف بياناته.</p>
        <div className={css.actions}><button className={css.button} type="button" disabled={actionBusy}
          onClick={()=>void changeProfile(learner,'archive')}>{actionBusy?'جارٍ الأرشفة…':'تأكيد الأرشفة'}</button>
          <button className={`${css.button} ${css.secondary}`} type="button" disabled={actionBusy}
            onClick={()=>setArchiveId(null)}>تراجع</button></div>
      </div>}
    </li>)}</ul> : <p>حسابك جاهز. أضف أول طالب لفتح لوحة التعلم.</p>}
    <form className={css.form} onSubmit={add} id="create-learner-form">
      <label htmlFor="new-account-learner">اسم الطالب<input id="new-account-learner" name="name" required maxLength={50} autoComplete="off" /></label>
      <label htmlFor="new-account-type">نوع الملف<select id="new-account-type" name="learnerType" defaultValue="child"><option value="child">طفل / فرد من الأسرة</option><option value="adult">بالغ</option></select></label>
      <button type="submit" className={css.button} disabled={busy || uncertain || actionBusy || actionUncertain || learners.length >= 8}>{busy ? 'جارٍ الحفظ…' : 'أضف ملف الطالب'}</button>
    </form>
    {error && <p role="alert" className={css.error}>{error}</p>}
    {actionError && <p role="alert" className={css.error}>{actionError}</p>}
    {actionUncertain && <button type="button" className={`${css.button} ${css.secondary}`} onClick={() => { setActionUncertain(false); void account.refresh(); }}>تحديث الملفات قبل تكرار العملية</button>}
    {uncertain && <button type="button" className={`${css.button} ${css.secondary}`} onClick={() => { void account.refresh(); }}>حدّث القائمة للتحقق قبل إعادة الإضافة</button>}
    <p className={css.hint}>الحصص والتدريبات والتقارير ستظهر عند ربط خدماتها. لا يتم إنشاء حجوزات أو اشتراكات هنا.</p>
  </section>;
}
