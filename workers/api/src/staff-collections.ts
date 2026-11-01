/** #307: four staff-only, read-only D1 collections for Admin Phase B.
 * There is no user-provided SQL, search parameter, account override, mutation,
 * payment success, guardian contact, incident reason or private child media.
 */
import type {CoreDatabase} from './bindings.ts';
import {canManageTeachers} from './staff-teachers.ts';

export const STAFF_COLLECTION_LIMIT=50;
export const ADMIN_COLLECTION_VIEWS=['students','schedule','subscriptions','attendance'] as const;
export type AdminCollectionView=typeof ADMIN_COLLECTION_VIEWS[number];
type Row=Record<string,unknown>;
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const whole=(x:unknown):x is number=>Number.isSafeInteger(x)&&Number(x)>=0;
const label=(x:unknown,max=120):x is string=>
 typeof x==='string'&&x.length>=1&&x.length<=max&&x.trim()===x;
const key=(x:unknown):x is string=>typeof x==='string'&&ID.test(x);
const exact=(r:Row,keys:readonly string[])=>
 Object.keys(r).length===keys.length&&keys.every(k=>Object.hasOwn(r,k));

/** Do not select auth subject, guardian phone, emails, attendance reasons,
 * grades, audio or finance. All rows are bounded and deterministic.
 * D1 permits padded display names (CHECK validates length(TRIM(name)), not
 * stored whitespace); normalize selected labels rather than failing the
 * entire staff collection on otherwise valid academic records.
 */
export const COLLECTION_QUERIES:Record<AdminCollectionView,string>={
 students:`
 SELECT learner.id AS id,TRIM(learner.display_name) AS name,
  learner.learner_type AS learnerType,learner.status AS status,
  (SELECT COUNT(*) FROM lessons l WHERE l.learner_id=learner.id) AS lessonCount
 FROM learners learner
 JOIN accounts owner ON owner.id=learner.account_id
 WHERE owner.status='active'
 ORDER BY learner.created_at_ms DESC,learner.id DESC
 LIMIT 51
 `,
 schedule:`
 SELECT lesson.id AS id,lesson.starts_at_ms AS startsAtMs,
  lesson.kind AS kind,lesson.status AS status,
  TRIM(learner.display_name) AS learnerName,TRIM(staff.name) AS teacherName
 FROM lessons lesson
 JOIN learners learner ON learner.id=lesson.learner_id
 JOIN teachers teacher ON teacher.id=lesson.actual_teacher_id
 JOIN auth_users staff ON staff.id=teacher.auth_subject
 WHERE lesson.starts_at_ms>=? AND lesson.starts_at_ms<=?
 ORDER BY lesson.starts_at_ms ASC,lesson.id ASC
 LIMIT 51
 `,
 subscriptions:`
 SELECT cycle.id AS id,TRIM(learner.display_name) AS learnerName,
  cycle.starts_at_ms AS startsAtMs,cycle.ends_at_ms AS endsAtMs,
  cycle.base_sessions AS baseSessions,
  cycle.rollover_sessions AS rolloverSessions,
  (SELECT COUNT(*) FROM subscription_spend_events spend
   WHERE spend.source_kind='cycle' AND spend.source_id=cycle.id) AS spentSessions
 FROM subscription_cycles cycle
 JOIN learners learner ON learner.id=cycle.learner_id
 ORDER BY cycle.starts_at_ms DESC,cycle.id DESC
 LIMIT 51
 `,
 attendance:`
 SELECT appeal.id AS id,incident.kind AS kind,
  appeal.submitted_at_ms AS submittedAtMs,
  COALESCE(review.decision,'pending') AS decision
 FROM attendance_appeal_events appeal
 JOIN attendance_incident_events incident ON incident.id=appeal.incident_id
 LEFT JOIN attendance_review_events review ON review.appeal_id=appeal.id
 ORDER BY appeal.submitted_at_ms DESC,appeal.id DESC
 LIMIT 51
 `,
};
export const COLLECTION_FIELDS:Record<AdminCollectionView,readonly string[]>={
 students:['id','name','learnerType','status','lessonCount'],
 schedule:['id','startsAtMs','kind','status','learnerName','teacherName'],
 subscriptions:['id','learnerName','startsAtMs','endsAtMs','baseSessions','rolloverSessions','spentSessions'],
 attendance:['id','kind','submittedAtMs','decision'],
};
function valid(view:AdminCollectionView,row:unknown):row is Row{
 if(!row||typeof row!=='object'||Array.isArray(row))return false;
 const r=row as Row;
 if(!exact(r,COLLECTION_FIELDS[view])||!key(r.id))return false;
 switch(view){
  case 'students':
   return label(r.name,80)&&(r.learnerType==='child'||r.learnerType==='adult')&&
    (r.status==='active'||r.status==='archived')&&whole(r.lessonCount);
  case 'schedule':
   return whole(r.startsAtMs)&&label(r.learnerName,80)&&label(r.teacherName)&&
    ['trial','standard','makeup'].includes(String(r.kind))&&
    ['scheduled','live','completed','cancelled'].includes(String(r.status));
  case 'subscriptions':
   return label(r.learnerName,80)&&whole(r.startsAtMs)&&whole(r.endsAtMs)&&
    Number(r.endsAtMs)>Number(r.startsAtMs)&&whole(r.baseSessions)&&
    Number(r.baseSessions)>=1&&Number(r.baseSessions)<=60&&
    whole(r.rolloverSessions)&&Number(r.rolloverSessions)<=60&&
    whole(r.spentSessions)&&Number(r.spentSessions)<=Number(r.baseSessions)+Number(r.rolloverSessions);
  case 'attendance':
   return whole(r.submittedAtMs)&&
    (r.kind==='student_no_show'||r.kind==='connection_interruption')&&
    (r.decision==='pending'||r.decision==='accepted'||r.decision==='rejected');
 }
}
export function isAdminCollectionView(x:string|null):x is AdminCollectionView{
 return ADMIN_COLLECTION_VIEWS.some(v=>v===x);
}
export async function readStaffCollection(db:CoreDatabase,subject:string,
 view:AdminCollectionView,now=Date.now()){
 if(!Number.isSafeInteger(now)||now<0)
  return {status:503,code:'CLOCK_UNAVAILABLE'} as const;
 if(!await canManageTeachers(db,subject))
  return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 const args:unknown[]=view==='schedule'?[Math.max(0,now-7*86400000),now+30*86400000]:[];
 const result=await db.prepare(COLLECTION_QUERIES[view]).bind(...args).all<Row>();
 if(!Array.isArray(result.results)||result.results.length>STAFF_COLLECTION_LIMIT+1||
  result.results.some(row=>!valid(view,row)))
  return {status:503,code:'STAFF_COLLECTION_UNAVAILABLE'} as const;
 const rows=result.results.slice(0,STAFF_COLLECTION_LIMIT).map(row=>({...row}));
 if(new Set(rows.map(row=>row.id)).size!==rows.length)
  return {status:503,code:'STAFF_COLLECTION_UNAVAILABLE'} as const;
 return {status:200,code:'STAFF_COLLECTION',view,asOfMs:now,readOnly:true as const,
  rows,truncated:result.results.length>STAFF_COLLECTION_LIMIT} as const;
}
