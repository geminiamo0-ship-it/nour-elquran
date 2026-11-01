'use client';
import {useEffect,useState} from 'react';
import {subscriptionLedgerClient,type SubscriptionLedger} from '../../shared';
import {currentCycleLabel} from '../../shared/academy-owner-client';
import css from './StudentSubscription.module.css';
type State={phase:'loading'}|{phase:'error'}|{phase:'ready';ledger:SubscriptionLedger};
const format=new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',dateStyle:'medium'});
/** Academic units are factual D1 ledger entries, NOT proof of payment/bookable credits. */
export function ConnectedSubscriptionLedger({learnerId}:{learnerId:string}){
 const [view,setView]=useState<State>({phase:'loading'});
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const ctrl=new AbortController();setView({phase:'loading'});
  void subscriptionLedgerClient.owner(learnerId,ctrl.signal).then(ledger=>{
   if(!ctrl.signal.aborted)setView({phase:'ready',ledger});
  }).catch(()=>{if(!ctrl.signal.aborted)setView({phase:'error'});});
  return()=>ctrl.abort();
 },[learnerId,retry]);
 const cycle=view.phase==='ready'?view.ledger.latestCycle:null;
 return <section className={css.hero} aria-label="حالة اشتراك الطالب">
  <div className={css.heroTop}>
   <h2>اشتراكي</h2>
   {view.phase==='ready'&&<span className={css.heroBadge}>
    {cycle?currentCycleLabel(cycle.state,cycle.endsAtMs,Date.now()):'بانتظار التفعيل'}</span>}
  </div>
  {view.phase==='loading'?<p className={css.heroPlaceholder} role="status">
   جارٍ التحقق من سجل هذا الطالب…</p>:
   view.phase==='error'?<div role="alert">
    <p className={css.heroPlaceholder}>تعذّر عرض حالة الاشتراك.</p>
    <button type="button" className={css.buttonOutline} onClick={()=>setRetry(n=>n+1)}>
     إعادة المحاولة</button>
   </div>:cycle?<div className={css.heroFacts}>
    <div className={css.heroFact}><small>حصص الدورة غير المستخدمة</small>
     <strong>{cycle.recordedUnspentSessions.toLocaleString('ar-EG')}</strong></div>
    <div className={css.heroFact}><small>نهاية الدورة المسجلة</small>
     <strong>{format.format(new Date(cycle.endsAtMs))}</strong></div>
    {view.ledger.compensationUnspentSessions>0&&
     <div className={css.heroFact}><small>حصص تعويض مسجلة</small>
      <strong>{view.ledger.compensationUnspentSessions.toLocaleString('ar-EG')}</strong></div>}
   </div>:<p className={css.heroPlaceholder}>لم تُسجّل دورة حصص لهذا الطالب حتى الآن.</p>}
  <p className={css.heroNote}>رصيد حصص أكاديمي مسجّل، وليس تأكيد دفع أو تصريح حجز؛
   التفعيل والحجز عبر إدارة الأكاديمية.</p>
 </section>;
}
