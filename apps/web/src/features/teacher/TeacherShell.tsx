'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useState,type ReactNode} from 'react';
import {AccountGate,useAccount} from '@/features/account';
import {TeacherReadOnlyView,TEACHER_READONLY_ENABLED} from './TeacherReadOnlyView';
import {resolveTeacherPortalMode} from './teacher-portal-mode';
import styles from './TeacherPortal.module.css';

/** No public/anonymous fixtures are reachable from the canonical Sheikh
 * portal. Static legacy story components remain only for isolated tests.
 */
const navigation=[
 {href:'/teacher',label:'الرئيسية',icon:'⌂'},
 {href:'/teacher/schedule',label:'جدولي وحصصي',icon:'▦'},
 {href:'/teacher/students',label:'طلابي',icon:'♧'},
 {href:'/teacher/preparation',label:'تحضير الحصة',icon:'۞'},
 {href:'/teacher/assignments',label:'الواجبات والتسميعات',icon:'✎'},
 {href:'/teacher/reports',label:'تقارير الحصص',icon:'▤'},
 {href:'/teacher/notifications',label:'الإشعارات',icon:'♢'},
 {href:'/teacher/cases',label:'الحضور والمتابعة',icon:'◷'},
] as const;
function TeacherFrame(){
 const pathname=usePathname();
 const {state:account}=useAccount();
 const mode=resolveTeacherPortalMode(TEACHER_READONLY_ENABLED,account.status);
 const [menuOpen,setMenuOpen]=useState(false);
 const links=(mobile=false)=>navigation.map(item=>
  <Link href={item.href} key={item.href}
   aria-current={pathname===item.href?'page':undefined}
   className={pathname===item.href?styles.navActive:styles.navLink}
   onClick={mobile?()=>setMenuOpen(false):undefined}>
   <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
   <span>{item.label}</span>
  </Link>);
 return <div className={styles.root}>
  <div className={styles.demoNotice} role="note">
   {mode==='connected'?
    'بوابة الشيخ الموثقة — كل بيانات الطلاب والحصص من Cloudflare D1. الخدمات غير المكتملة معطّلة بوضوح؛ لا توجد بيانات افتراضية.':
    'بوابة الشيخ محمية بالحساب والصلاحيات. لا توجد معاينة ببيانات طلاب وهمية.'}
  </div>
  <header className={styles.topBar}>
   <Link href="/" className={styles.brand}>
    <span className={styles.brandSymbol} aria-hidden="true">۞</span>
    <span><strong>نور القرآن</strong><small>بوابة الشيخ · لِلحِفْظِ وَالْإِتْقَان</small></span>
   </Link>
   <div className={styles.topActions}>
    <Link className={styles.notificationButton} href="/teacher/notifications"
     aria-label="مركز الإشعارات">♢</Link>
    <div className={styles.teacherIdentity}>
     <span className={styles.avatar}>ش</span>
     <span><b>{mode==='connected'?'حساب الشيخ الموثق':'بوابة الشيخ'}</b>
      <small>{mode==='connected'?'صلاحيات تُتحقق من الخادم':'يلزم تسجيل الدخول'}</small>
     </span>
    </div>
    <button type="button" className={styles.menuButton}
     aria-expanded={menuOpen} aria-controls="teacher-mobile-nav"
     onClick={()=>setMenuOpen(v=>!v)}>☰
     <span className={styles.srOnly}>القائمة</span>
    </button>
   </div>
  </header>
  <div className={styles.layout}>
   <aside className={styles.sidebar}>
    <p className={styles.sideCaption}>مساحة إدارة التعليم</p>
    <nav aria-label="أقسام بوابة الشيخ" className={styles.sideNav}>{links()}</nav>
    <div className={styles.sideFooter}>
     <b>﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾</b>
     <span>الفصل المباشر يُفتح من حصة مصرح بها في جدول الشيخ.</span>
    </div>
   </aside>
   <main id="teacher-content" className={styles.main}>
    {mode==='connected'?<TeacherReadOnlyView pathname={pathname}/>:
     mode==='checking'?<section role="status">جارٍ التحقق من الجلسة…</section>:
     account.status==='signed-out'?<AccountGate/>:
     <section role="alert">لا يمكن عرض بوابة الشيخ الآن. يلزم تفعيل
      خدمة الحساب والتحقق من الصلاحية؛ لن نعرض بيانات تجريبية بديلة.</section>}
   </main>
  </div>
  {menuOpen&&<nav id="teacher-mobile-nav" aria-label="قائمة الشيخ على الهاتف"
   className={styles.mobileNav}>{links(true)}</nav>}
 </div>;
}
export function TeacherShell({children}:{children:ReactNode}){
 // Teacher routes are rendered exclusively from signed teacher API state.
 // Their legacy page-level fixtures are intentionally never mounted.
 void children;
 return <TeacherFrame/>;
}
