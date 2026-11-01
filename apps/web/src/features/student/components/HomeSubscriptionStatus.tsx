'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {subscriptionLedgerClient,type SubscriptionLedger} from '../../shared';
import {readOwnerAcademy,latestPendingAcademyRequest,currentCycleLabel,
 type OwnerAcademy} from '../../shared/academy-owner-client';
import css from './StudentSubscription.module.css';

type View={phase:'loading'}|{phase:'ready';ledger:SubscriptionLedger|null;academy:OwnerAcademy|null};
const day=new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',day:'numeric',month:'short'});
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
   const pending=data.academy&&latestPendingAcademyRequest(data.academy);
   const cycle=data.ledger?.latestCycle;
   if(pending){status='طلب باقة قيد المراجعة';detail='بانتظار قرار الإدارة';}
   else if(cycle){
    status=currentCycleLabel(cycle.state,cycle.endsAtMs,Date.now());
    detail=cycle.recordedUnspentSessions.toLocaleString('ar-EG')+
     ' حصص مسجلة غير مستخدمة · حتى '+day.format(new Date(cycle.endsAtMs));
   }else if(data.ledger){status='لا توجد دورة حصص مسجلة';detail='';}
   else if(data.academy){status='لم يُؤكَّد الاشتراك بعد';detail='';}
   else{status='تعذّر عرض حالة الاشتراك';detail='افتح التفاصيل للتحقق.';}
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
