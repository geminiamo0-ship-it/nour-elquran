'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useState,type ReactNode} from 'react';
import {SCENARIOS,type Scenario} from './domain';
import {TeacherProvider,useTeacher} from './TeacherContext';
import styles from './TeacherPortal.module.css';
import {TeacherReadOnlyView,TEACHER_READONLY_ENABLED} from './TeacherReadOnlyView';

const navigation=[
  {href:'/teacher',label:'الرئيسية',icon:'⌂'},
  {href:'/teacher/schedule',label:'جدولي وحصصي',icon:'▦'},
  {href:'/teacher/students',label:'طلابي',icon:'♧'},
  {href:'/teacher/preparation',label:'تحضير الحصة',icon:'۞'},
  {href:'/classroom',label:'معاينة الفصل التفاعلي',icon:'▧'},
  {href:'/teacher/assignments',label:'الواجبات والتسميعات',icon:'✎'},
  {href:'/teacher/reports',label:'تقارير الحصص',icon:'▤'},
  {href:'/teacher/notifications',label:'الإشعارات',icon:'♢'},
  {href:'/teacher/cases',label:'الحضور والمتابعة',icon:'◷'},
] as const;
function TeacherFrame({children}:{children:ReactNode}) {
  const pathname=usePathname();
  const {scenario,setScenario,notices,note,clearNote,incidents}=useTeacher();
  const [menuOpen,setMenuOpen]=useState(false);
  const unread=notices.filter(item=>!item.read).length;
  const pending=incidents.filter(item=>item.status==='pending').length;
  const links=(mobile=false)=>navigation.map(item=><Link href={item.href} key={item.href}
    aria-current={pathname===item.href?'page':undefined}
    className={pathname===item.href?styles.navActive:styles.navLink}
    onClick={mobile?()=>setMenuOpen(false):undefined}>
    <span className={styles.navIcon} aria-hidden="true">{item.icon}</span><span>{item.label}</span>
    {item.href.endsWith('/notifications')&&unread>0&&<span className={styles.navCount}>{unread}</span>}
    {item.href.endsWith('/cases')&&pending>0&&<span className={styles.navCount}>{pending}</span>}
  </Link>);
  return <div className={styles.root}>
    <div className={styles.demoNotice} role="note">
      {TEACHER_READONLY_ENABLED?<><strong>قراءة من Cloudflare D1</strong> — يتم عرض الطلاب والمواعيد المصرح بها فقط؛ التقارير والواجبات والحصة المباشرة لم تُربط بعد.</>:
      <><strong>معاينة واجهة الشيخ</strong> — بيانات وسيناريوهات افتراضية للتصميم والاختبار، لا يوجد نشر تقارير أو إرسال رسائل أو حضور حقيقي.</>}
    </div>
    <header className={styles.topBar}>
      <Link href="/" className={styles.brand}><span className={styles.brandSymbol} aria-hidden="true">۞</span><span><strong>نور القرآن</strong><small>بوابة الشيخ · لِلحِفْظِ وَالْإِتْقَان</small></span></Link>
      <div className={styles.topActions}>
        {!TEACHER_READONLY_ENABLED&&<label className={styles.scenarioPicker} htmlFor="teacher-scenario"><span>اختبار سيناريو</span>
          <select id="teacher-scenario" value={scenario} onChange={event=>setScenario(event.target.value as Scenario)}>
            {SCENARIOS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>}
        <Link className={styles.notificationButton} href="/teacher/notifications" aria-label={`الإشعارات: ${unread} غير مقروءة`}>
          ♢ {unread>0&&<span>{unread}</span>}</Link>
        <div className={styles.teacherIdentity}><span className={styles.avatar}>ش</span><span><b>{TEACHER_READONLY_ENABLED?'بوابة الشيخ المصرح':'حساب الشيخ التجريبي'}</b><small>{TEACHER_READONLY_ENABLED?'قراءة محمية فقط':'معاينة غير متصلة'}</small></span></div>
        <button type="button" className={styles.menuButton} aria-expanded={menuOpen} aria-controls="teacher-mobile-nav"
          onClick={()=>setMenuOpen(v=>!v)}>☰ <span className={styles.srOnly}>القائمة</span></button>
      </div>
    </header>
    <div className={styles.layout}>
      <aside className={styles.sidebar}><p className={styles.sideCaption}>مساحة إدارة التعليم</p>
        <nav aria-label="أقسام بوابة الشيخ" className={styles.sideNav}>{links()}</nav>
        <div className={styles.sideFooter}><b>﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾</b><span>المصحف المشترك وإدارة الفصل قيد التطوير.</span></div>
      </aside>
      <main id="teacher-content" className={styles.main}>{TEACHER_READONLY_ENABLED?<TeacherReadOnlyView pathname={pathname}/>:children}</main>
    </div>
    {menuOpen&&<nav id="teacher-mobile-nav" aria-label="قائمة الشيخ على الهاتف" className={styles.mobileNav}>{links(true)}</nav>}
    {!TEACHER_READONLY_ENABLED&&note&&<div className={styles.toast} role="status"><span>{note}</span><button type="button" aria-label="إغلاق التنبيه" onClick={clearNote}>×</button></div>}
  </div>;
}
export function TeacherShell({children}:{children:ReactNode}) {
  return <TeacherProvider><TeacherFrame>{children}</TeacherFrame></TeacherProvider>;
}
