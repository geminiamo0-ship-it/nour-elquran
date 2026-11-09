'use client';
import {useStudent} from '../StudentContext';
import {ConnectedSubscriptionLedger} from './ConnectedSubscriptionLedger';
import {ConnectedAcademyOffers} from './ConnectedAcademyOffers';
import css from './StudentSubscription.module.css';

/** Signed entitlements and package requests remain distinct; neither UI grants credit. */
export function SubscriptionWorkspace(){
 const {selected}=useStudent();
 const demo=selected.profile.demo;
 return <div className={css.page} dir="rtl">
  <header className={css.titleRow}>
   <div><h1>الاشتراك والباقات</h1><p>رصيد حصصي وباقاتي في مكان واحد.</p></div>
  </header>
  {demo?<>
   <section className={css.hero} aria-label="معاينة حالة الاشتراك">
    <div className={css.heroTop}><h2>اشتراكي</h2>
     <span className={css.heroBadge}>معاينة فقط</span></div>
    <p className={css.heroPlaceholder}>تظهر الحالة ورصيد الحصص الفعليان بعد تسجيل الدخول.</p>
    <p className={css.heroNote}>هذه ليست بيانات دفع أو اشتراك لطالب حقيقي.</p>
   </section>
   <section className={css.catalogSection} aria-label="مثال شكل الباقات">
    <h2 className={css.sectionTitle}>الباقات المتاحة</h2>
    <div className={css.packages}>
     <article className={css.package}><h3>باقة شهرية — مثال تصميم</h3>
      <div className={css.packagePrice}>— <small>جنيه / شهر</small></div>
      <div className={css.packageSessions}>عدد الحصص والسعر يحددهما مسؤول الأكاديمية</div>
      <button type="button" className={css.button} disabled>طلب الباقة غير متاح في المعاينة</button>
     </article>
    </div>
    <p className={css.meta}>تظهر باقات الأكاديمية المنشورة وأسعارها وطلباتك بعد تسجيل الدخول.</p>
   </section>
  </>:<>
   <ConnectedSubscriptionLedger key={selected.profile.id} learnerId={selected.profile.id}/>
   <ConnectedAcademyOffers key={selected.profile.id} learnerId={selected.profile.id}/>
  </>}
 </div>;
}
