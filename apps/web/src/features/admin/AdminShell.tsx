'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {AccountGate,useAccount} from '@/features/account';
import {adminApi,AdminAccessError,type AdminCapabilities} from './api';
import styles from './AdminShell.module.css';

type Section='overview'|'teachers'|'attendance';
type Access=
 | {kind:'idle'|'loading'|'denied'|'error'}
 | {kind:'ready';permissions:AdminCapabilities};
const sectionInfo:Record<Section,{label:string;description:string}>={
 overview:{label:'الرئيسية',description:'المتابعة التشغيلية ستكون مرتبطة بسجلات D1 المصرح بها. لا توجد أرقام أو حصص افتراضية.'},
 teachers:{label:'إدارة الشيوخ',description:'تتوفر صلاحية إدارة الشيوخ. قوائم الدعوات والمراجعة والتفعيل ستُربط بالبيانات الموثقة في مرحلة لاحقة.'},
 attendance:{label:'اعتراضات الحضور',description:'تتوفر صلاحية مراجعة الاعتراضات. عرض الحالات والقرارات الفعلية سيُربط بواجهة الإدارة في مرحلة لاحقة.'},
};
export function AdminShell(){
 const {state:account}=useAccount();
 const subject=account.status==='authenticated'?account.session.user.id:null;
 const [access,setAccess]=useState<Access>({kind:'idle'});
 const [retry,setRetry]=useState(0);
 const [section,setSection]=useState<Section>('overview');
 const [menuOpen,setMenuOpen]=useState(false);
 useEffect(()=>{
  if(!subject){setAccess({kind:'idle'});return;}
  const controller=new AbortController();
  setAccess({kind:'loading'});
  void adminApi.capabilities(controller.signal).then(permissions=>{
   if(!controller.signal.aborted)setAccess({kind:'ready',permissions});
  }).catch((error:unknown)=>{
   if(controller.signal.aborted)return;
   setAccess({kind:error instanceof AdminAccessError&&
    (error.status===401||error.status===403)?'denied':'error'});
  });
  return ()=>controller.abort();
 },[subject,retry]);
 const allowed=access.kind==='ready'?access.permissions:null;
 const visible:Section[]=allowed?[
  'overview',...(allowed.manageTeachers?['teachers' as const]:[]),
  ...(allowed.reviewAttendance?['attendance' as const]:[]),
 ]:[];
 const current=visible.includes(section)?section:'overview';
 const nav=visible.map(id=><button type="button" key={id}
  className={current===id?styles.navActive:styles.navButton}
  aria-current={current===id?'page':undefined}
  onClick={()=>{setSection(id);setMenuOpen(false);}}>
  {sectionInfo[id].label}
 </button>);
 return <div className={styles.root}>
  <header className={styles.header}>
   <Link href="/" className={styles.brand}><span aria-hidden="true" className={styles.mark}>۞</span>
    <span><strong>نور القرآن</strong><small>لوحة إدارة الأكاديمية</small></span>
   </Link>
   <span className={styles.headerHint}>صلاحيات موثقة من الخادم</span>
   {allowed&&<button type="button" className={styles.menuButton}
    aria-expanded={menuOpen} aria-controls="admin-navigation"
    onClick={()=>setMenuOpen(value=>!value)}>القائمة</button>}
  </header>
  {account.status==='signed-out'?<div className={styles.gate}><AccountGate/></div>:
   account.status!=='authenticated'?<main className={styles.gate} role="status">
    {account.status==='checking'?'جارٍ التحقق من تسجيل الدخول…':
     'تعذر التحقق من الحساب. لا يمكن فتح لوحة الإدارة دون جلسة موثقة.'}
   </main>:
   !allowed?<main className={styles.gate}>
    {access.kind==='denied'?<div role="alert">
     <h1>غير مصرح بالدخول</h1><p>هذا الحساب لا يمتلك صلاحية إدارة موثقة ونشطة.</p>
    </div>:<div role={access.kind==='error'?'alert':'status'}>
     <h1>التحقق من صلاحيات الإدارة</h1>
     <p>{access.kind==='error'?'تعذر الاتصال بخدمة الصلاحيات. لم يتم عرض أي بيانات إدارية.':
      'جارٍ التحقق من الصلاحيات من Cloudflare D1…'}</p>
     {access.kind==='error'&&<button type="button" className={styles.retry}
      onClick={()=>setRetry(value=>value+1)}>إعادة المحاولة</button>}
    </div>}
   </main>:
   <div className={styles.layout}>
    <aside id="admin-navigation" className={menuOpen?styles.sidebarOpen:styles.sidebar}>
     <p className={styles.sideCaption}>أقسام متاحة حسب الصلاحية</p>
     <nav aria-label="أقسام الإدارة" className={styles.nav}>{nav}</nav>
     <p className={styles.sideNote}>لا توجد بيانات تجريبية أو عمليات مالية مفعلة.</p>
    </aside>
    <main className={styles.main} id="admin-content">
     <p className={styles.eyebrow}>إدارة نور القرآن / {sectionInfo[current].label}</p>
     <h1>{sectionInfo[current].label}</h1>
     <p className={styles.lead}>{sectionInfo[current].description}</p>
     <section className={styles.panel} aria-labelledby="admin-connection-title">
      <h2 id="admin-connection-title">حالة الربط</h2>
      <p>تم التحقق من الجلسة وصلاحيات الإدارة عبر الخادم. عرض السجلات التشغيلية
       وتنفيذ القرارات غير متاحين من هذه الواجهة بعد، ولن تُعرض بيانات وهمية.</p>
      <p className={styles.note}>العمليات الحساسة تتطلب واجهات D1 مستقلة،
       تدقيقًا وصلاحيات على مستوى كل إجراء قبل تفعيلها.</p>
     </section>
    </main>
   </div>}
 </div>;
}
