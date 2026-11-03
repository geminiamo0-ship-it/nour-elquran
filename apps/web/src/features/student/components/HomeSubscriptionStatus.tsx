'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {subscriptionLedgerClient,type SubscriptionLedger} from '../../shared';
import {readOwnerAcademy,latestPendingAcademyRequest,currentCycleLabel,
 type OwnerAcademy} from '../../shared';
import css from './StudentSubscription.module.css';

type View={phase:'loading'}|{phase:'ready';ledger:SubscriptionLedger|null;academy:OwnerAcademy|null};
const day=new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',day:'numeric',month:'short'});
/** The academy catalog is not an entitlement source. If the academic ledger
 * fails, an empty package request list must never be presented as proof
 * that the learner has no subscription. */
export function homeSubscriptionSummary(ledger:SubscriptionLedger|null,
 academy:OwnerAcademy|null,now:number):{status:string;detail:string}{
 const pending=academy&&latestPendingAcademyRequest(academy);
 const cycle=ledger?.latestCycle;
 const compensation=ledger?.compensationUnspentSessions??0;
 // A pending renewal/package request does not replace an already recorded
 // learner cycle. Keep the D1 balance visible and mention the request beside it.
 if(cycle)return {
  status:currentCycleLabel(cycle.state,cycle.endsAtMs,now),
  detail:cycle.recordedUnspentSessions.toLocaleString('ar-EG')+
   ' حصص مسجلة غير مستخدمة · حتى '+day.format(new Date(cycle.endsAtMs))+
   (compensation>0?' · '+compensation.toLocaleString('ar-EG')+' حصص تعويض مسجلة':'')+
   (pending?' · طلب باقة قيد المراجعة':'')
 };
 // Compensation is a separate durable entitlement, even without a current
 // subscription cycle. Do not hide it behind an empty-cycle or renewal label.
 if(ledger&&compensation>0)return {status:'حصص تعويض مسجلة',
  detail:compensation.toLocaleString('ar-EG')+' حصص تعويض غير مستخدمة'+
   (pending?' · طلب باقة قيد المراجعة':'')};
 if(pending)return {status:'طلب باقة قيد المراجعة',
  detail:ledger?'بانتظار قرار الإدارة':'بانتظار قرار الإدارة · تعذّر التحقق من رصيد الحصص'};
 if(ledger)return {status:'لا توجد دورة حصص مسجلة',detail:''};
 return {status:'تعذّر التحقق من حالة الاشتراك',detail:'افتح التفاصيل للتحقق.'};
}
/** Single non-blocking status strip. Never delays or erases the signed learning dashboard. */
export function HomeSubscriptionStatus({learnerId,preview=false,basePath='/student'}:{
 learnerId?:string;preview?:boolean;basePath?:string
}){
 const [data,setData]=useState<View>({phase:'loading'});
 useEffect(()=>{
  if(!learnerId||preview)return;
  const ctrl=new AbortController();setData({phase:'loading'});
  void Promise.allSettled([
   subscriptionLedgerClient.owner(learnerId,ctrl.signal),
   readOwnerAcademy(learnerId,ctrl.signal)
  ]).then(([ledger,academy])=>{
   if(!ctrl.signal.aborted)setData({phase:'ready',
    ledger:ledger.status==='fulfilled'?ledger.value:null,
    academy:academy.status==='fulfilled'?academy.value:null});
  });
  return()=>ctrl.abort();
 },[learnerId,preview]);
 if(!preview&&!learnerId)return null;
 const to=basePath+'/subscription';
 let status='معاينة الباقات';let detail='أسعار الاشتراك تظهر من الأكاديمية بعد تسجيل الدخول.';
 if(!preview){
  if(data.phase==='loading'){status='جارٍ التحقق من الاشتراك…';detail='';}
  else{
   ({status,detail}=homeSubscriptionSummary(data.ledger,data.academy,Date.now()));
  }
 }
 return <section className={css.homeStrip} aria-label="ملخص الاشتراك">
  <div className={css.homeMain}>
   <strong className={css.homeLabel}>اشتراكي</strong>
   <span className={css.homeState} role="status">{status}</span>
   {detail&&<span className={css.homeDetail}>{detail}</span>}
  </div>
  <Link className={css.homeLink} href={to}>{preview?'معاينة الباقات':'إدارة الاشتراك'} ←</Link>
 </section>;
}
