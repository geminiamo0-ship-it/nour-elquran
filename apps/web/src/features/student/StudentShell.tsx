'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { StudentProvider, useStudent } from './StudentContext';
import styles from './StudentPortal.module.css';

export const studentNavigation = [
  { href: '/student', label: 'الرئيسية', icon: '⌂' },
  { href: '/student/lessons', label: 'حصصي', icon: '▦' },
  { href: '/student/mushaf', label: 'المصحف', icon: '۞' },
  { href: '/student/training', label: 'تدريباتي', icon: '✎' },
  { href: '/student/progress', label: 'تقدمي وتقاريري', icon: '▥' },
  { href: '/student/notebook', label: 'دفتر الحصص', icon: '▤' },
  { href: '/student/subscription', label: 'الاشتراك', icon: '◇' },
  { href: '/student/account', label: 'الحساب', icon: '⚙' },
] as const;

function Frame({ children }: { children: ReactNode }) {
  const { learners, selectedId, selectLearner, selected } = useStudent();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const selectedNav = (href: string) => pathname === href;
  const navigation = (mobile = false) => studentNavigation.map((item) => (
    <Link key={item.href} href={item.href} aria-current={selectedNav(item.href) ? 'page' : undefined}
      className={selectedNav(item.href) ? styles.navActive : styles.navLink}
      onClick={mobile ? () => setMobileOpen(false) : undefined}>
      <span aria-hidden="true" className={styles.navIcon}>{item.icon}</span><span>{item.label}</span>
    </Link>
  ));
  const inMushaf = pathname === '/student/mushaf';
  return <div className={inMushaf ? `${styles.root} ${styles.mushafScreen}` : styles.root} id="student-top">
    <div className={styles.demoBanner} role="note">معاينة تفاعلية للواجهة فقط — لا توجد حسابات أو حصص أو اشتراكات حقيقية</div>
    <header className={styles.topBar}>
      <div className={styles.topContent}>
        <Link href="/" className={styles.wordmark} aria-label="نور القرآن، العودة للرئيسية">
          <span className={styles.logo} aria-hidden="true">۞</span>
          <span><strong>نور القرآن</strong><small>لِلحِفْظِ وَالْإِتْقَان</small></span>
        </Link>
        <div className={styles.topTools}>
          <div className={styles.profileGroup}>
            <label htmlFor="learner-switch">ملف الطالب</label>
            <select id="learner-switch" aria-label="اختر ملف الطالب" value={selectedId}
              onChange={(event) => selectLearner(event.target.value)}>
              {learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.name}</option>)}
            </select>
          </div>
          <span className={styles.stageTag}>{selected.profile.stage === 'new' ? 'لم تبدأ الحصص' :
            selected.profile.stage === 'active' ? 'حالة نشطة · مثال' :
            selected.profile.stage === 'trial_booked' ? 'حصة تجريبية · مثال' : 'حالة توضيحية'}</span>
          <button type="button" className={styles.mobileToggle} aria-label="فتح القائمة" aria-expanded={mobileOpen}
            aria-controls="student-navigation-mobile" onClick={() => setMobileOpen((value) => !value)}>☰</button>
        </div>
      </div>
    </header>
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label="قائمة الطالب">
        <p className={styles.sidebarCaption}>مساحتي التعليمية</p>
        <nav className={styles.sideNav}>{navigation()}</nav>
        <div className={styles.sideHelp}>
          <span aria-hidden="true">✦</span><strong>تعلّم على مهل</strong>
          <p>حفظٌ بإتقان، ومراجعةٌ برفق. كل ملف طالب مستقل عن الآخر.</p>
        </div>
      </aside>
      <main className={styles.main} id="student-main">{children}</main>
    </div>
    {mobileOpen && <nav id="student-navigation-mobile" className={styles.mobileMenu} aria-label="القائمة المختصرة">
      {navigation(true)}
    </nav>}
    <nav className={styles.bottomNav} aria-label="التنقل السريع للطالب">
      {studentNavigation.slice(0,5).map((item) =>
        <Link href={item.href} key={item.href} aria-current={selectedNav(item.href) ? 'page' : undefined}
          className={selectedNav(item.href) ? styles.bottomActive : styles.bottomLink}>
          <span aria-hidden="true">{item.icon}</span><small>{item.label}</small>
        </Link>)}
    </nav>
  </div>;
}
export function StudentShell({ children }: { children: ReactNode }) {
  return <StudentProvider><Frame>{children}</Frame></StudentProvider>;
}
