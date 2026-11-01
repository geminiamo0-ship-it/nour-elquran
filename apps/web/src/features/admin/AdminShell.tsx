'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useState} from 'react';
import {AccountGate,useAccount} from '@/features/account';
import {ADMIN_NAVIGATION,getAdminRoute} from './admin-navigation';
import {AdminOverviewPanel,AdminPendingSection} from './AdminSections';
import {AdminOverviewError,fetchAdminOverview,type AdminOverview} from './admin-overview-client';
import css from './AdminPortal.module.css';

/** Static build-level opt-in. Worker performs an independent D1 grant check. */
export const ADMIN_PORTAL_ENABLED=
 process.env.NEXT_PUBLIC_ADMIN_PORTAL_ENABLED==='true'&&
 process.env.NEXT_PUBLIC_ACCOUNT_UI==='true';
type ReadState=
 |{phase:'idle'}
 |{phase:'loading'|'denied'|'error';subject:string}
 |{phase:'ready';subject:string;value:AdminOverview};

function AccessMessage({title,detail,action}:{title:string;detail:string;action?:()=>void}){
 return <section className={css.access} role="status" dir="rtl">
  <span className={css.brandMark} aria-hidden="true">۞</span>
  <p className={css.kicker}>نور القرآن · لوحة الإدارة</p><h1>{title}</h1>
  <p>{detail}</p>
  <div className={css.accessActions}>
   {action&&<button type="button" onClick={action}>إعادة المحاولة</button>}
   <Link href="/">العودة للموقع الرئيسي</Link>
  </div>
 </section>;
}

export function AdminShell(){
 const pathname=usePathname();
 const {state:account}=useAccount();
 const subject=account.status==='authenticated'?account.session.user.id:null;
 const [read,setRead]=useState<ReadState>({phase:'idle'});
 const [retry,setRetry]=useState(0);
 const [menuOpen,setMenuOpen]=useState(false);
 useEffect(()=>{
  if(!ADMIN_PORTAL_ENABLED||!subject){
   setRead({phase:'idle'});return;
  }
  const ctrl=new AbortController();
  setRead({phase:'loading',subject});
  void fetchAdminOverview(ctrl.signal).then(value=>{
   if(!ctrl.signal.aborted)setRead({phase:'ready',subject,value});
  }).catch(error=>{
   if(!ctrl.signal.aborted)setRead({phase:error instanceof AdminOverviewError&&
    (error.status===401||error.status===403||error.status===404)?'denied':'error',subject});
  });
  return ()=>ctrl.abort();
 },[subject,retry]);
 if(!ADMIN_PORTAL_ENABLED)return <AccessMessage title="لوحة الإدارة غير مفعّلة"
  detail="الواجهة قيد التجهيز على بيئة التطوير. لا توجد أي صلاحيات أو بيانات إدارية متاحة على هذا الإصدار."/>;
 if(account.status==='signed-out')return <AccountGate/>;
 if(account.status!=='authenticated')return <AccessMessage
  title={account.status==='checking'?'جارٍ التحقق من حسابك':'تعذّر التحقق من الجلسة'}
  detail="لن تظهر أي بيانات إدارية قبل التحقق من جلسة الحساب وصلاحيات الإدارة على الخادم."/>;
 // A stale result from a different account can never render, even before effect cleanup.
 if(read.phase==='idle'||read.subject!==subject||read.phase==='loading')
  return <AccessMessage title="جارٍ التحقق من صلاحية الإدارة"
   detail="نراجع جلسة الحساب ومنح الصلاحيات الحالية في D1 قبل عرض أي إحصاءات."/>;
 if(read.phase==='denied')return <AccessMessage
  title="غير مصرح بعرض لوحة الإدارة"
  detail="هذا الحساب ليس لديه تصريح إدارة نشط ومتحقق منه. لا يمكن استخدام حساب ولي الأمر أو الشيخ كحساب إدارة."
  action={()=>setRetry(n=>n+1)}/>;
 if(read.phase==='error')return <AccessMessage
  title="تعذّر تحميل البيانات الإدارية"
  detail="البيانات غير متاحة الآن؛ لن نستبدلها بأرقام صفرية أو بيانات تجريبية."
  action={()=>setRetry(n=>n+1)}/>;
 const route=getAdminRoute(pathname);
 const nav=ADMIN_NAVIGATION.map(item=>
  <Link key={item.href} href={item.href} aria-current={route===item.href?'page':undefined}
   className={route===item.href?css.navActive:css.navLink}
   onClick={()=>setMenuOpen(false)}><span aria-hidden="true" className={css.navSymbol}>{item.symbol}</span>
   <span>{item.label}</span>{!item.connected&&<small>قريبًا</small>}</Link>);
 return <div className={css.root} dir="rtl">
  <header className={css.topBar}>
   <div className={css.brand}><span className={css.brandMark} aria-hidden="true">۞</span>
    <div><strong>نور القرآن</strong><small>لوحة إدارة الأكاديمية</small></div></div>
   <div className={css.topActions}>
    <span className={css.readonlyTag}>وضع القراءة فقط</span>
    <button type="button" className={css.menuButton}
     aria-controls="admin-mobile-navigation" aria-expanded={menuOpen}
     onClick={()=>setMenuOpen(v=>!v)}>القائمة</button>
   </div>
  </header>
  <div className={css.layout}>
   <aside className={css.sidebar} aria-label="أقسام لوحة الإدارة">
    <p>لوحة التحكم</p><nav className={css.sideNav}>{nav}</nav>
    <div className={css.sideFooter}>كل صلاحية تتطلب جلسة موثقة ومنحة إدارية سارية.</div>
   </aside>
   <main className={css.main} id="admin-main">
    {route==='/admin'
     ?<AdminOverviewPanel value={read.value} onRefresh={()=>setRetry(n=>n+1)}/>
     :<AdminPendingSection route={route}/>}
   </main>
  </div>
  {menuOpen&&<nav id="admin-mobile-navigation" className={css.mobileNav}
   aria-label="قائمة الإدارة على الهاتف">{nav}</nav>}
 </div>;
}
