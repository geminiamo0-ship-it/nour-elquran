import type {CoreDatabase,Env} from './bindings.ts';
import {checkTeacherClassroomAccess} from './classroom-access.ts';
import {forwardVerifiedPresence} from './classroom/presence.ts';

const id=/^[A-Za-z0-9-]{1,128}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isObject=(v:unknown):v is Record<string,unknown>=>
 v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:readonly string[])=>
 Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
type IncidentKind='student_no_show'|'connection_interruption';
export type IncidentCommand=Readonly<{
 operationId:string;kind:IncidentKind;reason:string;
}>;
export type AppealCommand=Readonly<{
 operationId:string;incidentId:string;reason:string;
}>;
export type ReviewCommand=Readonly<{
 operationId:string;appealId:string;decision:'accepted'|'rejected';reason:string;
}>;
export function parseIncident(raw:unknown):IncidentCommand|null{
 if(!isObject(raw)||!exact(raw,['operationId','kind','reason'])||
  typeof raw.operationId!=='string'||!uuid.test(raw.operationId)||
  !['student_no_show','connection_interruption'].includes(String(raw.kind))||
  typeof raw.reason!=='string'||raw.reason.trim().length<10||
  raw.reason.trim().length>500)return null;
 return {operationId:raw.operationId,kind:raw.kind as IncidentKind,reason:raw.reason.trim()};
}
export function parseAppeal(raw:unknown):AppealCommand|null{
 if(!isObject(raw)||!exact(raw,['operationId','incidentId','reason'])||
  typeof raw.operationId!=='string'||!uuid.test(raw.operationId)||
  typeof raw.incidentId!=='string'||!uuid.test(raw.incidentId)||
  typeof raw.reason!=='string'||raw.reason.trim().length<10||
  raw.reason.trim().length>1000)return null;
 return {operationId:raw.operationId,incidentId:raw.incidentId,reason:raw.reason.trim()};
}
export function parseReview(raw:unknown):ReviewCommand|null{
 if(!isObject(raw)||!exact(raw,['operationId','appealId','decision','reason'])||
  typeof raw.operationId!=='string'||!uuid.test(raw.operationId)||
  typeof raw.appealId!=='string'||!uuid.test(raw.appealId)||
  (raw.decision!=='accepted'&&raw.decision!=='rejected')||
  typeof raw.reason!=='string'||raw.reason.trim().length<10||
  raw.reason.trim().length>500)return null;
 return {operationId:raw.operationId,appealId:raw.appealId,
  decision:raw.decision,reason:raw.reason.trim()};
}
type StoredIncident={id:string;operation_id:string;actor_subject:string;
 lesson_id:string;learner_id:string;kind:IncidentKind;reason:string;reported_at_ms:number};
const incidentRead=`SELECT id,operation_id,actor_subject,lesson_id,learner_id,kind,
 reason,reported_at_ms FROM attendance_incident_events WHERE operation_id=?`;
const equivalent=(prev:StoredIncident,actor:string,lessonId:string,learnerId:string,
 c:IncidentCommand)=>prev.actor_subject===actor&&prev.lesson_id===lessonId&&
 prev.learner_id===learnerId&&prev.kind===c.kind&&prev.reason===c.reason;
export async function reportAttendanceIncident(env:Env,subject:string,
 lessonId:string,raw:unknown,now=Date.now()){
 const cmd=parseIncident(raw);
 if(!cmd)return {status:400,code:'INVALID_ATTENDANCE_REPORT'} as const;
 if(!env.DB||!id.test(lessonId))return {status:404,code:'NOT_FOUND'} as const;
 const db=env.DB;
 const access=await checkTeacherClassroomAccess(db,subject,lessonId,now);
 if(!access)return {status:404,code:'NOT_FOUND'} as const;
 const prior=await db.prepare(incidentRead).bind(cmd.operationId).first<StoredIncident>();
 if(prior)return equivalent(prior,subject,lessonId,access.learnerId,cmd)
  ?{status:200,code:'ATTENDANCE_REPORT_REPLAY',incidentId:prior.id} as const
  :{status:409,code:'ATTENDANCE_REPORT_CONFLICT'} as const;
 // Source of the teacher's presence is the signed verified LessonDO, never
 // an untrusted browser claim that the learner was absent or disconnected.
 const presence=await forwardVerifiedPresence(env,{lessonId,learnerId:access.learnerId,
  actorSubject:subject,role:'teacher'},'heartbeat');
 if(presence.status!==200||!presence.presence.teacherPresent)
  return {status:503,code:'ATTENDANCE_PRESENCE_UNVERIFIED'} as const;
 if(cmd.kind==='student_no_show'&&presence.presence.learnerPresent)
  return {status:409,code:'LEARNER_PRESENT_IN_ROOM'} as const;
 if(cmd.kind==='student_no_show'&&access.status!=='scheduled')
  return {status:409,code:'NO_SHOW_NOT_ELIGIBLE'} as const;
 if(cmd.kind==='connection_interruption'&&access.status!=='live')
  return {status:409,code:'CONNECTION_REPORT_REQUIRES_LIVE'} as const;
 const incidentId=crypto.randomUUID();
 try{
  await db.prepare(`INSERT INTO attendance_incident_events(id,operation_id,
   lesson_id,learner_id,actor_subject,kind,reason,reported_at_ms)
   VALUES(?,?,?,?,?,?,?,?)`)
   .bind(incidentId,cmd.operationId,lessonId,access.learnerId,subject,
    cmd.kind,cmd.reason,now).run();
 }catch(e){
  const raced=await db.prepare(incidentRead).bind(cmd.operationId).first<StoredIncident>();
  if(raced&&equivalent(raced,subject,lessonId,access.learnerId,cmd))
   return {status:200,code:'ATTENDANCE_REPORT_REPLAY',incidentId:raced.id} as const;
  if(e instanceof Error&&/constraint|ATTENDANCE_|abort|UNIQUE/i.test(e.message))
   return {status:409,code:'ATTENDANCE_REPORT_DENIED'} as const;
  throw e;
 }
 return {status:201,code:'ATTENDANCE_REPORT_RECORDED',incidentId} as const;
}
async function verifiedOwner(db:CoreDatabase,subject:string,learnerId:string){
 if(!id.test(learnerId))return false;
 const row=await db.prepare(`SELECT 1 AS allowed FROM learners l JOIN accounts a
  ON a.id=l.account_id WHERE l.id=? AND l.status='active'
   AND a.status='active' AND a.auth_subject=?`)
  .bind(learnerId,subject).first<{allowed:number}>();
 return row?.allowed===1;
}
type AppealPrev={id:string;incident_id:string;learner_id:string;
 actor_subject:string;reason:string;operation_id:string};
export async function submitAttendanceAppeal(db:CoreDatabase,subject:string,
 learnerId:string,raw:unknown,now=Date.now()){
 const cmd=parseAppeal(raw);
 if(!cmd)return {status:400,code:'INVALID_ATTENDANCE_APPEAL'} as const;
 if(!await verifiedOwner(db,subject,learnerId))
  return {status:404,code:'NOT_FOUND'} as const;
 const find=()=>db.prepare(`SELECT id,incident_id,learner_id,actor_subject,reason,operation_id
  FROM attendance_appeal_events WHERE operation_id=?`).bind(cmd.operationId).first<AppealPrev>();
 const previous=await find();
 const replay=(p:AppealPrev)=>p.incident_id===cmd.incidentId&&p.learner_id===learnerId&&
  p.actor_subject===subject&&p.reason===cmd.reason?
  {status:200,code:'ATTENDANCE_APPEAL_REPLAY',appealId:p.id} as const:
  {status:409,code:'ATTENDANCE_APPEAL_CONFLICT'} as const;
 if(previous)return replay(previous);
 const incident=await db.prepare(`SELECT id,reported_at_ms FROM attendance_incident_events
  WHERE id=? AND learner_id=? AND kind='student_no_show'`)
  .bind(cmd.incidentId,learnerId).first<{id:string;reported_at_ms:number}>();
 if(!incident||now<incident.reported_at_ms||now>incident.reported_at_ms+604800000)
  return {status:409,code:'APPEAL_WINDOW_CLOSED'} as const;
 const appealId=crypto.randomUUID();
 try{
  await db.prepare(`INSERT INTO attendance_appeal_events(
   id,operation_id,incident_id,learner_id,actor_subject,reason,submitted_at_ms)
   VALUES(?,?,?,?,?,?,?)`).bind(appealId,cmd.operationId,cmd.incidentId,
    learnerId,subject,cmd.reason,now).run();
 }catch(e){
  const raced=await find();
  if(raced)return replay(raced);
  if(e instanceof Error&&/constraint|ATTENDANCE_|abort|UNIQUE/i.test(e.message))
   return {status:409,code:'ATTENDANCE_APPEAL_DENIED'} as const;
  throw e;
 }
 return {status:201,code:'ATTENDANCE_APPEAL_SUBMITTED',appealId} as const;
}
export async function listOwnerAttendance(db:CoreDatabase,subject:string,learnerId:string){
 if(!await verifiedOwner(db,subject,learnerId))
  return {status:404,code:'NOT_FOUND'} as const;
 const rows=await db.prepare(`SELECT i.id AS incidentId,i.lesson_id AS lessonId,
  i.kind,i.reason,i.reported_at_ms AS reportedAtMs,
  a.id AS appealId,a.submitted_at_ms AS appealedAtMs,
  d.decision AS decision,d.reason AS decisionReason,d.reviewed_at_ms AS decidedAtMs
  FROM attendance_incident_events i LEFT JOIN attendance_appeal_events a
   ON a.incident_id=i.id LEFT JOIN attendance_review_events d ON d.appeal_id=a.id
  WHERE i.learner_id=? ORDER BY i.reported_at_ms DESC,i.id DESC LIMIT 50`)
 .bind(learnerId).all<Record<string,unknown>>();
 return {status:200,code:'ATTENDANCE_CASES',incidents:rows.results} as const;
}
export async function listTeacherAttendance(db:CoreDatabase,subject:string){
 const row=await db.prepare(`SELECT 1 AS allowed FROM teachers
  WHERE auth_subject=? AND status='active' AND qualified=1`)
 .bind(subject).first<{allowed:number}>();
 if(row?.allowed!==1)return {status:403,code:'TEACHER_ACCESS_DENIED'} as const;
 const rows=await db.prepare(`SELECT i.id AS incidentId,i.learner_id AS learnerId,
  i.lesson_id AS lessonId,i.kind,i.reason,i.reported_at_ms AS reportedAtMs
  FROM attendance_incident_events i JOIN lessons l ON l.id=i.lesson_id
  JOIN teachers t ON t.id=l.actual_teacher_id WHERE i.actor_subject=?
    AND t.auth_subject=? AND t.status='active' AND t.qualified=1
  ORDER BY i.reported_at_ms DESC,i.id DESC LIMIT 50`)
 .bind(subject,subject).all<Record<string,unknown>>();
 return {status:200,code:'ATTENDANCE_CASES',incidents:rows.results} as const;
}
async function staffAllowed(db:CoreDatabase,subject:string){
 // #309: attendance reviewers must meet the same independently-verified
 // identity standard as staff teachers. Never accept a caller role assertion.
 const row=await db.prepare(`SELECT 1 AS allowed FROM staff_grants g
  JOIN accounts a ON a.auth_subject=g.auth_subject
  JOIN auth_users u ON u.id=g.auth_subject
  WHERE g.auth_subject=? AND g.permission='attendance.review'
   AND g.revoked_at_ms IS NULL AND a.status='active'
   AND u.phone_number_verified=1 LIMIT 1`)
 .bind(subject).first<{allowed:number}>();
 return row?.allowed===1;
}
export async function listStaffAttendanceAppeals(db:CoreDatabase,subject:string){
 if(!await staffAllowed(db,subject))
  return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 const rows=await db.prepare(`SELECT a.id AS appealId,a.incident_id AS incidentId,
 a.learner_id AS learnerId,a.reason,a.submitted_at_ms AS submittedAtMs,
 d.decision,d.reason AS decisionReason,d.reviewed_at_ms AS decidedAtMs
 FROM attendance_appeal_events a LEFT JOIN attendance_review_events d ON d.appeal_id=a.id
 ORDER BY a.submitted_at_ms DESC,a.id DESC LIMIT 100`).all<Record<string,unknown>>();
 return {status:200,code:'ATTENDANCE_APPEALS',appeals:rows.results} as const;
}
type ReviewPrev={id:string;appeal_id:string;actor_subject:string;
 decision:'accepted'|'rejected';reason:string};
export async function reviewAttendanceAppeal(db:CoreDatabase,subject:string,raw:unknown,
 now=Date.now()){
 const cmd=parseReview(raw);
 if(!cmd)return {status:400,code:'INVALID_ATTENDANCE_REVIEW'} as const;
 if(!await staffAllowed(db,subject))
  return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 const find=()=>db.prepare(`SELECT id,appeal_id,actor_subject,decision,reason
  FROM attendance_review_events WHERE operation_id=?`).bind(cmd.operationId).first<ReviewPrev>();
 const old=await find();
 const replay=(p:ReviewPrev)=>p.appeal_id===cmd.appealId&&p.actor_subject===subject&&
  p.decision===cmd.decision&&p.reason===cmd.reason?
  {status:200,code:'ATTENDANCE_REVIEW_REPLAY',decisionId:p.id} as const:
  {status:409,code:'ATTENDANCE_REVIEW_CONFLICT'} as const;
 if(old)return replay(old);
 const id=crypto.randomUUID();
 try{
  await db.prepare(`INSERT INTO attendance_review_events(
   id,operation_id,appeal_id,actor_subject,decision,reason,reviewed_at_ms)
   VALUES(?,?,?,?,?,?,?)`).bind(id,cmd.operationId,cmd.appealId,subject,
    cmd.decision,cmd.reason,now).run();
 }catch(e){
  const raced=await find();
  if(raced)return replay(raced);
  if(e instanceof Error&&/constraint|ATTENDANCE_|abort|UNIQUE/i.test(e.message))
   return {status:409,code:'ATTENDANCE_REVIEW_DENIED'} as const;
  throw e;
 }
 return {status:201,code:'ATTENDANCE_REVIEW_RECORDED',decisionId:id} as const;
}
