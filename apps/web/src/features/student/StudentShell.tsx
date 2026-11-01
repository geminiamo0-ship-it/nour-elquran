'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useMemo,useState,type ReactNode} from 'react';
import {ACCOUNT_UI_ENABLED,AccountGate,SessionControls,useAccount} from '@/features/account';
import type {LearnerProfile} from './domain';
import {StudentProvider,useStudent} from './StudentContext';
import {DEMO_PROFILES} from './mock-adapter';
import {StudentConnectedInbox} from './components/StudentConnectedInbox';
import old from './StudentPortal.module.css';
import css from './StudentPremium.module.css';

export const studentNavigation=[
 {href:'/student',label:'الرئيسية',icon:'home'},
 {href:'/student/lessons',label:'حصصي',icon:'calendar'},
 {href:'/student/training',label:'تدريباتي',icon:'target'},
 {href:'/student/mushaf',label:'المصحف',icon:'book'},
] as const;
type IconName=(typeof studentNavigation)[number]['icon']|'bell'|'user'|'chevron'|'settings';
function Icon({name,size=22}:{name:IconName;size?:number}){
 const common={width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true as const};
 switch(name){
 case 'home':return <svg {...common}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/></svg>;
 case 'calendar':return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h3m2 0h3m-8 4h3"/></svg>;
 case 'target':return <svg {...common}><circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="4"/><path d="m11 13 10-10m-6 0h6v6"/></svg>;
 case 'book':return <svg {...common}><path d="M12 6c-3-2-7-2-10-1v14c4-1 8-1 10 2 2-3 6-3 10-2V5c-3-1-7-1-10 1Zm0 0v15"/></svg>;
 case 'bell':return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 10h18c0-2-3-3-3-10m-8 13h4"/></svg>;
 case 'user':return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3-8 8-8s8 3 8 8"/></svg>;
 case 'settings':return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1m0-14.2L17 7M7 17l-2.1 2.1"/></svg>;
 default:return <svg {...common}><path d="m7 10 5 5 5-5"/></svg>;
 }
}
function Frame({children,preview=false}:{children:ReactNode;preview?:boolean}){
 const {learners,selectedId,selectLearner,selected}=useStudent();
 const pathname=usePathname();
 const router=useRouter();
 const destination=(href:string)=>preview?href.replace(/^\/student/,'/preview/student'):href;
 const [noticeOpen,setNoticeOpen]=useState(false);
 const [switchWarning,setSwitchWarning]=useState('');
 const inReader=pathname===destination('/student/mushaf');
 const active=(href:string)=>href==='/student/lessons'
  ?[destination('/student/lessons'),destination('/student/progress'),destination('/student/notebook')].includes(pathname)
  :pathname===destination(href);
 function previewClick(event:import('react').MouseEvent<HTMLElement>){
  if(!preview||event.defaultPrevented||!(event.target instanceof Element))return;
  const href=event.target.closest('a[href]')?.getAttribute('href');
  if(!href||!/^\/student(?:\/|$|#)/.test(href))return;
  event.preventDefault();event.stopPropagation();
  const next=href.startsWith('/student/progress')?'/preview/student/lessons#reports':
   href.startsWith('/student/notebook')?'/preview/student/lessons#notebook':
   href.startsWith('/student/account')?'/preview/student':
   href.replace(/^\/student/,'/preview/student');
  router.push(next);
 }
 const nav=studentNavigation.map(item=><Link href={destination(item.href)} key={item.href}
   aria-current={active(item.href)?'page':undefined}
   className={active(item.href)?css.activeLink:css.navLink}>
   <Icon name={item.icon}/><span>{item.label}</span></Link>);
 return <div className={`${old.root} ${css.shell} ${inReader?`${old.mushafScreen} ${css.reader}`:''}`} id="student-top">
  <div className={css.frame}>
   <aside className={css.sidebar} aria-label="التنقل الرئيسي للطالب">
    <Link href={destination('/student')} className={css.brand} aria-label="نور القرآن، الرئيسية">
     <span className={css.brandSymbol} aria-hidden="true"><svg viewBox="0 0 84 84" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M42 9a19 19 0 0 0 18 28 22 22 0 1 1-18-28Z"/>
      <path d="M14 46c11-6 23-5 28 1 5-6 17-7 28-1v25c-12-4-22-4-28 2-6-6-16-6-28-2V46Zm28 1v26"/>
      <path d="M21 54c7-2 12-1 17 2m8 0c5-3 10-4 17-2M21 61c7-2 12-1 17 2m8 0c5-3 10-4 17-2"/>
     </svg></span>
     <strong>نُورُ القُرْآن</strong><small>لتحفيظ القرآن الكريم</small>
    </Link>
    <nav className={css.sideNav} aria-label="الصفحات الرئيسية">{nav}</nav>
    <div className={css.sidebarArt} aria-hidden="true"><span>☪</span><span>۞</span></div>
   </aside>
   <div className={css.contentArea}>
    <header className={css.header}>
     <div className={css.identity}>
      <span className={css.avatar}><Icon name="user" size={24}/></span>
      <div className={css.learnerSwitch}>
       <label htmlFor="learner-switch">ملف الطالب</label>
       <select id="learner-switch" value={selectedId} aria-label="اختر ملف الطالب"
        onChange={e=>{
         if(document.querySelector('[data-quran-save-status="pending"],[data-quran-save-status="failed"]')){
          setSwitchWarning('لا يمكن تبديل ملف الطالب قبل اكتمال حفظ المصحف. أعد المحاولة من المصحف.');
          return;
         }
         setSwitchWarning('');setNoticeOpen(false);selectLearner(e.target.value);
        }}>
        {learners.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
       </select>
      </div>
      <details className={css.accountMenu}>
       <summary aria-label="الحساب والاشتراك"><Icon name="chevron" size={18}/></summary>
       <div className={css.accountPopover}>
        {preview?<div className={css.previewMenuNote}>معاينة بصرية فقط؛ لا توجد مدفوعات حقيقية.<p><Link href="/preview/student/subscription">معاينة الاشتراك والباقات</Link></p></div>:<>
        <Link href="/student/account"><Icon name="user" size={17}/> الحساب والملفات</Link>
        <Link href="/student/subscription"><Icon name="settings" size={17}/> الاشتراك والدفع</Link>
        {!selected.profile.demo&&<div className={css.sessionMenu}><SessionControls/></div>}
        </>}
       </div>
      </details>
     </div>
     <div className={css.headerActions}>
      <button type="button" className={css.bell} aria-label="إشعارات الطالب"
        aria-controls="student-notices" aria-expanded={noticeOpen}
        onClick={()=>setNoticeOpen(open=>!open)}><Icon name="bell"/></button>
      {noticeOpen&&<div id="student-notices" className={css.notices} dir="rtl">
       <div className={css.noticeTitle}><strong>إشعاراتي</strong>
        <button type="button" onClick={()=>setNoticeOpen(false)} aria-label="إغلاق الإشعارات">×</button></div>
       {selected.profile.demo?<p>لا توجد إشعارات موثقة في المعاينة.</p>:
        <StudentConnectedInbox key={selected.profile.id} learnerId={selected.profile.id}/>}
      </div>}
      {switchWarning&&<p className={css.switchWarning} role="status">{switchWarning}</p>}
     </div>
    </header>
    {preview&&!inReader&&<div className={css.previewRibbon} role="note">معاينة التصميم فقط · جميع الأسماء والمواعيد والتقييمات أمثلة وليست حسابات حقيقية</div>}
    <main className={css.main} id="student-main" onClickCapture={preview?previewClick:undefined}>{children}</main>
   </div>
  </div>
  <nav className={css.mobileNav} aria-label="الصفحات الرئيسية للطالب">
   {studentNavigation.map(item=><Link href={destination(item.href)} key={item.href}
     aria-current={active(item.href)?'page':undefined}
     className={active(item.href)?css.mobileActive:css.mobileLink}>
     <Icon name={item.icon} size={22}/><span>{item.label}</span>
    </Link>)}
  </nav>
 </div>;
}
export function StudentShell({children}:{children:ReactNode}){
 return ACCOUNT_UI_ENABLED ? <ConnectedStudentShell>{children}</ConnectedStudentShell>
    : <AccountGate/>;
}
function ConnectedStudentShell({children}:{children:ReactNode}){
 const {state}=useAccount();
 const profiles=useMemo<readonly LearnerProfile[]>(()=>state.status==='authenticated'
  ?state.learners.map(row=>({id:row.id,name:row.name,stage:'new',demo:false})):[],[state]);
 if(state.status!=='authenticated'||profiles.length===0)return <AccountGate/>;
 return <StudentProvider key={state.session.user.id} liveLearners={profiles}><Frame>{children}</Frame></StudentProvider>;
}

/** Public design-only route: signed account APIs and private learner data are never mounted. */
const previewLearners:readonly LearnerProfile[]=DEMO_PROFILES.map(learner=>
 learner.id==='demo-active'?{...learner,name:'أحمد محمد (مثال)'}:learner);
export function StudentPreviewShell({children}:{children:ReactNode}){
 return <StudentProvider liveLearners={previewLearners} initialSelectedId="demo-active">
  <Frame preview>{children}</Frame>
 </StudentProvider>;
}
