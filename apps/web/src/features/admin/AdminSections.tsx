import Link from 'next/link';
import type {AdminOverview} from './admin-overview-client';
import {ADMIN_NAVIGATION,type AdminRoute} from './admin-navigation';
import css from './AdminPortal.module.css';

const counts=[
 {key:'activeLearners',title:'ملفات الطلاب النشطة',detail:'حسابات الطلاب فقط، دون بيانات شخصية'},
 {key:'activeQualifiedTeachers',title:'الشيوخ المؤهلون النشطون',detail:'من سجل الصلاحيات الحالي'},
 {key:'upcomingLessons',title:'الحصص المجدولة القادمة',detail:'حجوزات D1 الفعلية فقط'},
 {key:'completedLessons',title:'الحصص المكتملة',detail:'الحصص المكتملة المسجلة'},
] as const;

export function AdminOverviewPanel({value,onRefresh}:{value:AdminOverview;onRefresh:()=>void}){
 const format=new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',
  dateStyle:'medium',timeStyle:'short'});
 return <div className={css.content}>
  <section className={css.hero} aria-labelledby="admin-overview-heading">
   <div className={css.heroCopy}><p className={css.kicker}>إدارة العملية التعليمية</p>
    <h1 id="admin-overview-heading">نظرة عامة على الأكاديمية</h1>
    <p>ملخص أكاديمي مقروء من Cloudflare D1 بعد التحقق من صلاحية الإدارة.
     الأرقام ليست كشفًا ماليًا ولا تمنح صلاحية اعتماد الحصص أو المدفوعات.</p>
    <span className={css.updated}>آخر قراءة موثقة: {format.format(new Date(value.asOfMs))}</span>
   </div>
   <button type="button" className={css.heroButton} onClick={onRefresh}>
    تحديث الأرقام
   </button>
  </section>
  <section aria-label="إحصاءات الأكاديمية الموثقة">
   <div className={css.sectionHeading}><h2>مؤشرات من السجل الفعلي</h2>
    <span>قراءة فقط</span></div>
   <div className={css.metricGrid}>{counts.map(c=>
    <article className={css.metricCard} key={c.key}>
     <span className={css.metricLabel}>{c.title}</span>
     <strong className={css.metricValue}>{value.metrics[c.key].toLocaleString('ar-EG')}</strong>
     <small>{c.detail}</small>
    </article>)}</div>
  </section>
  <section className={css.nextSteps} aria-label="السجلات الإدارية المتصلة">
   <div className={css.sectionHeading}><h2>السجلات الموثقة</h2>
    <span>قراءة فقط · D1</span></div>
   <div className={css.linksGrid}>{ADMIN_NAVIGATION.filter(n=>n.connected&&
     n.href!=='/admin').map(n=>
    <Link className={css.nextLink} href={n.href} key={n.href}>
     <span aria-hidden="true">{n.symbol}</span><strong>{n.label}</strong>
     <small>عرض السجل بعد التحقق من الصلاحية</small>
    </Link>)}</div>
  </section>
  <section className={css.nextSteps} aria-label="أقسام الإدارة التي تنتظر الربط">
   <div className={css.sectionHeading}><h2>الأقسام قيد الاستكمال</h2>
    <span>بدون عمليات حساسة</span></div>
   <div className={css.linksGrid}>{ADMIN_NAVIGATION.filter(n=>!n.connected).map(n=>
    <Link className={css.nextLink} href={n.href} key={n.href}>
     <span aria-hidden="true">{n.symbol}</span><strong>{n.label}</strong>
     <small>عرض حدود القسم والخطوات المتبقية</small>
    </Link>)}</div>
  </section>
 </div>;
}

const notes:Record<Exclude<AdminRoute,'/admin'|'/admin/teachers'|'/admin/students'|'/admin/schedule'|'/admin/subscriptions'|'/admin/attendance'>,string>={
 '/admin/settings':'إعدادات الصلاحيات والإشعارات والربط الخارجي ستُفتح فقط بعد اعتماد التحقق والتدقيق وأذونات مزودي الخدمات.',
};
export function AdminPendingSection({route}:{route:Exclude<AdminRoute,'/admin'|'/admin/teachers'|'/admin/students'|'/admin/schedule'|'/admin/subscriptions'|'/admin/attendance'>}){
 const section=ADMIN_NAVIGATION.find(n=>n.href===route);
 return <section className={css.pending} aria-labelledby="admin-section-heading">
  <p className={css.kicker}>تأسيس الإدارة · مرحلة أولى</p>
  <h1 id="admin-section-heading">{section?.label}</h1>
  <p>{notes[route]}</p>
  <div className={css.pendingNotice} role="status">
   <strong>هذا القسم غير مفعل تشغيليًا</strong>
   <span>لا توجد سجلات تجريبية، ولا يمكن تنفيذ موافقات أو خصم رصيد أو إسناد شيخ من هذه الصفحة.</span>
  </div>
  <Link href="/admin" className={css.backLink}>العودة إلى النظرة العامة</Link>
 </section>;
}
