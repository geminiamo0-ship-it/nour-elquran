'use client';
import {useEffect,useState} from 'react';
import {academicPlanClient,planMessage,type AcademicPlan} from '../../shared/index';
import styles from '../StudentPortal.module.css';

type Reading={status:'loading'}|{status:'loaded';plan:AcademicPlan|null}|
 {status:'error';message:string};
const client=academicPlanClient();
const levels={beginner:'مبتدئ',intermediate:'متوسط',advanced:'متقدم'};
/** Server-confirmed teacher-authored plan only; no generated/demo academic claims. */
export function StudentAcademicPlanCard({learnerId}:{learnerId:string}){
 const [reading,setReading]=useState<Reading>({status:'loading'});
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  setReading({status:'loading'});
  void client.ownerPlan(learnerId,controller.signal).then(plan=>{
   if(active&&!controller.signal.aborted)setReading({status:'loaded',plan});
  }).catch(err=>{
   if(active&&!controller.signal.aborted)setReading({status:'error',message:planMessage(err)});
  });
  return ()=>{active=false;controller.abort();};
 },[learnerId,retry]);
 return <section className={styles.panel} aria-label="الورد المعتمد من الشيخ">
  <div className={styles.panelHead}><div><span className={styles.eyebrow}>خطة الحفظ والمراجعة</span>
   <h2>وردي القادم</h2></div></div>
  {reading.status==='loading'?<p role="status">جارٍ تحميل الورد المعتمد...</p>:
   reading.status==='error'?<div role="alert"><p>{reading.message}</p>
     <button type="button" onClick={()=>setRetry(v=>v+1)}>إعادة المحاولة</button></div>:
   reading.plan?<div>
    <p><strong>المستوى:</strong> {levels[reading.plan.level]}</p>
    <p><strong>الحفظ القادم:</strong> {reading.plan.nextWird}</p>
    <p><strong>المراجعة:</strong> {reading.plan.revisionWird}</p>
    <p><strong>التركيز:</strong> {reading.plan.focus}</p>
    <p className={styles.muted}>خطة الشيخ المعتمدة · الإصدار {reading.plan.revision}. ليست واجبًا منشورًا.</p>
   </div>:<div className={styles.emptyBox}>لم يُحدِّد الشيخ خطة لهذا الطالب بعد. ستظهر هنا عند حفظها.</div>}
 </section>;
}
