'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useAccount} from '@/features/account';
import styles from '@/features/account/Account.module.css';
/** The invitation proves possession of a 256-bit staff-issued single-use link.
 * It never independently grants an active teacher role or verifies a phone.
 */
export function TeacherInvitationJoin(){
 const {state,register,login}=useAccount();
 const [token,setToken]=useState('');
 const [mode,setMode]=useState<'register'|'login'>('register');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [claimed,setClaimed]=useState(false);
 useEffect(()=>{
  const value=new URLSearchParams(window.location.search).get('token')??'';
  setToken(/^[0-9a-f]{64}$/.test(value)?value:'');
 },[]);
 async function redeem(){
  if(!token||busy||claimed)return;
  setBusy(true);setMessage('');
  try{
   const res=await fetch('/v1/me/academy/invite-claim',{
    method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
   const d:unknown=await res.json();
   if(!res.ok||!d||typeof d!=='object'||Array.isArray(d)||
    !['ACADEMY_INVITE_CLAIMED'].includes(String((d as {code?:unknown}).code)))
    throw new Error('الدعوة غير متاحة أو استُخدمت أو انتهت صلاحيتها.');
   setClaimed(true);
   setMessage('تم تسجيل دعوتك بنجاح. سيظهر حسابك في لوحة الإدارة، وسيُفعّله المسؤول بعد التحقق.');
  }catch(e){setMessage(e instanceof Error?e.message:'تعذّر قبول الدعوة.');}
  finally{setBusy(false);}
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  const data=new FormData(event.currentTarget);
  const phoneNumber=String(data.get('phoneNumber')??'').trim();
  const password=String(data.get('password')??'');
  const name=String(data.get('name')??'').trim();
  setBusy(true);setMessage('');
  try{
   if(mode==='register')await register({name,phoneNumber,password});
   else await login({phoneNumber,password});
  }catch{
   setMessage('تعذّر تسجيل الدخول. راجع الموبايل وكلمة المرور أو جرّب الدخول لحسابك الحالي.');
  }finally{setBusy(false);}
 }
 return <main dir="rtl" className={styles.card} style={{maxWidth:540,margin:'40px auto'}}>
  <h1>انضم كشيخ في نور القرآن</h1>
  <p>التسجيل سريع: الاسم ورقم الموبايل وكلمة المرور فقط، بدون مؤهلات أو رفع مستندات.</p>
  {!token&&<p role="alert">الرابط غير صالح أو ناقص. اطلب رابط دعوة جديدًا من إدارة الأكاديمية.</p>}
  {token&&state.status==='authenticated'?<>
   <p>أهلًا {state.session.user.name}. اضغط قبول الدعوة بهذا الحساب.</p>
   {!claimed&&<button type="button" className={styles.button} disabled={busy}
    onClick={()=>void redeem()}>{busy?'جارٍ ربط الحساب…':'قبول الدعوة وإرسالها للإدارة'}</button>}
   {claimed&&<Link href="/teacher" className={styles.button}>فتح بوابة الشيخ بعد التفعيل</Link>}
  </>:token&&state.status==='signed-out'?<>
   <form className={styles.form} onSubmit={e=>void submit(e)}>
    {mode==='register'&&<label>اسم الشيخ<input name="name" required maxLength={80}/></label>}
    <label>رقم الموبايل<input type="tel" name="phoneNumber" required maxLength={24}
     dir="ltr" autoComplete="tel"/></label>
    <label>كلمة المرور<input type="password" name="password" required minLength={8}
     dir="ltr" autoComplete={mode==='register'?'new-password':'current-password'}/></label>
    <button className={styles.button} type="submit" disabled={busy}>
     {mode==='register'?'إنشاء حساب الشيخ':'تسجيل الدخول'}</button>
   </form>
   <button type="button" className={styles.button} disabled={busy}
    onClick={()=>setMode(m=>m==='register'?'login':'register')}>
    {mode==='register'?'عندي حساب بالفعل':'إنشاء حساب جديد'}</button>
  </>:token&&<p>جارٍ التحقق من الحساب…</p>}
  {message&&<p role="status">{message}</p>}
  <Link href="/">العودة للموقع الرئيسي</Link>
 </main>;
}
