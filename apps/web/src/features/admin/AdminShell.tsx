'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useState} from 'react';
import {AccountGate,useAccount,type AccountSession} from '@/features/account';
import {ADMIN_NAVIGATION,getAdminRoute} from './admin-navigation';
import {AdminOverviewPanel,AdminPendingSection} from './AdminSections';
import {AdminTeacherDirectory} from './AdminTeacherDirectory';
import {AdminCollectionPanel} from './AdminCollectionPanel';
import {AdminAcademyMvp} from './AdminAcademyMvp';
import {AdminBookingPanel} from './AdminBookingPanel';
import {AdminOverviewError,fetchAdminOverview,type AdminOverview} from './admin-overview-client';
import css from './AdminPortal.module.css';

/** Static build-level opt-in. Worker performs an independent D1 grant check. */
export const ADMIN_PORTAL_ENABLED=
 process.env.NEXT_PUBLIC_ADMIN_PORTAL_ENABLED==='true'&&
 process.env.NEXT_PUBLIC_ACCOUNT_UI==='true';
type ReadState=
 |{phase:'idle'}
 |{phase:'loading'|'denied'|'error';subject:string;session:AccountSession}
 |{phase:'ready';subject:string;session:AccountSession;value:AdminOverview};

/** A fresh sign-in under the same subject must not inherit cached staff data. */
export function isStaleAdminRead(read:ReadState,session:AccountSession|null):boolean{
 return read.phase==='idle'||!session||read.subject!==session.user.id||
  read.session!==session;
}

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
 const session=account.status==='authenticated'?account.session:null;
 const subject=session?.user.id??null;
 const [read,setRead]=useState<ReadState>({phase:'idle'});
 const [retry,setRetry]=useState(0);
 const [menuOpen,setMenuOpen]=useState(false);
 useEffect(()=>{
  if(!ADMIN_PORTAL_ENABLED||!session||!subject){
   setRead({phase:'idle'});return;
  }
  let current:AbortController|null=null;
  let mounted=true;
  // Never retain the privileged snapshot when the tab is hidden, navigated,
  // or its account lease changes. Every refresh rechecks D1 staff authority.
  const clear=()=>{
   current?.abort();
   if(mounted)setRead({phase:'loading',subject,session});
  };
  const refresh=()=>{
   if(!mounted)return;
   current?.abort();
   const ctrl=new AbortController();current=ctrl;
   // #319: retain a currently authorized same-session overview while D1
   // silently revalidates on focus and at the 30-second cadence.
   // Role swaps, logout, pagehide and 401/403 still clear the snapshot.
   setRead(previous=>previous.phase==='ready'&&previous.subject===subject&&
    previous.session===session?previous:{phase:'loading',subject,session});
   void fetchAdminOverview(ctrl.signal).then(value=>{
    if(mounted&&!ctrl.signal.aborted)
     setRead({phase:'ready',subject,session,value});
   }).catch(error=>{
    if(!mounted||ctrl.signal.aborted)return;
    setRead({phase:error instanceof AdminOverviewError&&
     (error.status===401||error.status===403||error.status===404)?'denied':'error',
     subject,session});
   });
  };
  const onWake=()=>{if(document.visibilityState==='visible')refresh();};
  const onVisible=()=>{if(document.visibilityState==='visible')refresh();else clear();};
  const channel=typeof BroadcastChannel==='undefined'?null:
   new BroadcastChannel('noor-account-session');
  if(channel)channel.onmessage=refresh;
  window.addEventListener('pageshow',onWake);
  window.addEventListener('focus',onWake);
  window.addEventListener('pagehide',clear);
  document.addEventListener('visibilitychange',onVisible);
  // Bounded periodic D1 revalidation limits stale staff grant exposure even
  // if the tab remains foregrounded after an out-of-band revocation.
  const timer=window.setInterval(onWake,30000);
  refresh();
  return ()=>{
   mounted=false;current?.abort();window.clearInterval(timer);
   channel?.close();
   window.removeEventListener('pageshow',onWake);
   window.removeEventListener('focus',onWake);
   window.removeEventListener('pagehide',clear);
   document.removeEventListener('visibilitychange',onVisible);
  };
 },[session,subject,retry,pathname]);
 if(!ADMIN_PORTAL_ENABLED)return <AccessMessage title="لوحة الإدارة غير مفعّلة"
  detail="الواجهة قيد التجهيز على بيئة التطوير. لا توجد أي صلاحيات أو بيانات إدارية متاحة على هذا الإصدار."/>;
 if(account.status==='signed-out')return <AccountGate/>;
 if(account.status!=='authenticated')return <AccessMessage
  title={account.status==='checking'?'جارٍ التحقق من حسابك':'تعذّر التحقق من الجلسة'}
  detail="لن تظهر أي بيانات إدارية قبل التحقق من جلسة الحساب وصلاحيات الإدارة على الخادم."/>;
 // A stale result from a different account can never render, even before effect cleanup.
 // Session-object identity also invalidates a snapshot when a new login uses
 // the same user ID. AccountProvider creates a fresh session on every refresh.
 if(isStaleAdminRead(read,session)||read.phase==='loading')
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
 if(read.phase!=='ready')return <AccessMessage
  title="جارٍ التحقق من البيانات"
  detail="لن تظهر أي إحصائيات قبل اكتمال استجابة الخادم."/>;
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
    <span className={css.readonlyTag}>الصلاحيات تُراجع قبل كل إجراء</span>
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
     :route==='/admin/teachers'
      ?<AdminTeacherDirectory session={account.session}/>
      :route==='/admin/students'
       ?<AdminCollectionPanel key={route} session={account.session} view="students"/>
       :route==='/admin/schedule'
        ?<><AdminCollectionPanel key={route} session={account.session} view="schedule"/>
           <AdminBookingPanel session={account.session} mode="paid"/></>
        :route==='/admin/subscriptions'
         ?<AdminCollectionPanel key={route} session={account.session} view="subscriptions"/>
         :route==='/admin/attendance'
          ?<AdminCollectionPanel key={route} session={account.session} view="attendance"/>
          :route==='/admin/packages'
           ?<AdminAcademyMvp key={route} session={account.session} mode="packages"/>
           :route==='/admin/requests'
            ?<><AdminAcademyMvp key={route} session={account.session} mode="requests"/>
              <AdminBookingPanel session={account.session} mode="trial"/></>
            :route==='/admin/settings'
             ?<AdminAcademyMvp key={route} session={account.session} mode="contact"/>
             :<AdminPendingSection route={route}/>}
   </main>
  </div>
  {menuOpen&&<nav id="admin-mobile-navigation" className={css.mobileNav}
   aria-label="قائمة الإدارة على الهاتف">{nav}</nav>}
 </div>;
}
