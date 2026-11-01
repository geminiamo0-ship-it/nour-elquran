/** #317: signed guardian proposals and staff decisions over immutable D1 events.
 * No direct payment, client-supplied timestamps, optimistic lesson or credit writes.
 */
import type {CoreDatabase} from './bindings.ts';
import {canManageTeachers} from './staff-teachers.ts';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuid=(v:unknown):v is string=>typeof v==='string'&&UUID.test(v);
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:readonly string[])=>
 Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const safeClock=(v:number)=>Number.isSafeInteger(v)&&v>=0;
const expected=(e:unknown)=>e instanceof Error&&
 /constraint|abort|ACADEMY_|SUBSCRIPTION_|UNIQUE|FOREIGN KEY/i.test(e.message);
const reason=(v:unknown)=>typeof v==='string'&&v.trim()===v&&v.length>=8&&v.length<=500;
const SLOT_MS=40*60*1000;
const WINDOW_MS=30*86400000;

async function owner(db:CoreDatabase,subject:string,learnerId:string){
 if(!uuid(learnerId))return false;
 const r=await db.prepare(`SELECT 1 AS allowed FROM learners l
 JOIN accounts a ON a.id=l.account_id WHERE l.id=? AND a.auth_subject=?
 AND l.status='active' AND a.status='active'`).bind(learnerId,subject)
 .first<{allowed:number}>();
 return r?.allowed===1;
}

export async function ownerPaidSlotRequests(db:CoreDatabase,subject:string,learnerId:string,now=Date.now()){
 if(!await owner(db,subject,learnerId))return {status:404,code:'NOT_FOUND'} as const;
 const rows=await db.prepare(`SELECT r.id AS requestId,r.teacher_id AS teacherId,
 r.starts_at_ms AS startsAtMs,r.ends_at_ms AS endsAtMs,
 CASE WHEN d.decision IS NOT NULL THEN d.decision
 WHEN r.starts_at_ms<=? THEN 'expired' ELSE 'pending' END AS state,
 d.lesson_id AS lessonId
 FROM academy_paid_slot_request_events r
 LEFT JOIN academy_paid_slot_decision_events d ON d.request_id=r.id
 WHERE r.learner_id=? ORDER BY r.requested_at_ms DESC,r.id DESC LIMIT 30`)
  .bind(now+60000,learnerId).all<Record<string,unknown>>();
 return {status:200,code:'ACADEMY_PAID_SLOT_REQUESTS',requests:rows.results} as const;
}

export async function ownerPaidSlotRequest(db:CoreDatabase,subject:string,
 learnerId:string,raw:unknown,now=Date.now()){
 if(!obj(raw)||!exact(raw,['operationId','teacherId','cycleId','startsAtMs'])||
 !uuid(raw.operationId)||!uuid(raw.teacherId)||!uuid(raw.cycleId)||
 !Number.isSafeInteger(raw.startsAtMs)||!safeClock(now))
 return {status:400,code:'ACADEMY_PAID_SLOT_INVALID'} as const;
 if(!await owner(db,subject,learnerId))return {status:404,code:'NOT_FOUND'} as const;
 // Two requests with the same operationId may race after their initial
 // lookup. Re-read after a constraint failure to preserve idempotent ACK.
 const findPrior=()=>db.prepare(`SELECT id,actor_subject AS actor,
 learner_id AS learnerId,teacher_id AS teacherId,cycle_id AS cycleId,
 starts_at_ms AS startsAtMs FROM academy_paid_slot_request_events
 WHERE operation_id=?`).bind(raw.operationId).first<{
 id:string;actor:string;learnerId:string;teacherId:string;cycleId:string;startsAtMs:number
 }>();
 const replay=(prior:NonNullable<Awaited<ReturnType<typeof findPrior>>>)=>
  prior.actor===subject&&prior.learnerId===learnerId&&
  prior.teacherId===raw.teacherId&&prior.cycleId===raw.cycleId&&
  prior.startsAtMs===raw.startsAtMs?
  {status:200,code:'ACADEMY_PAID_SLOT_REPLAY',slotRequestId:prior.id} as const:
  {status:409,code:'ACADEMY_OPERATION_CONFLICT'} as const;
 const prior=await findPrior();
 if(prior)return replay(prior);
 // A retried, identical operation must remain replayable even after its
 // proposed slot expires. Only NEW proposals need the future-slot window.
 if(Number(raw.startsAtMs)<now+60000||Number(raw.startsAtMs)>now+WINDOW_MS)
  return {status:400,code:'ACADEMY_PAID_SLOT_INVALID'} as const;
 const id=crypto.randomUUID();
 try{
  const write=await db.prepare(`INSERT INTO academy_paid_slot_request_events
  (id,operation_id,learner_id,teacher_id,cycle_id,actor_subject,
  starts_at_ms,ends_at_ms,requested_at_ms) VALUES(?,?,?,?,?,?,?,?,?)`)
  .bind(id,raw.operationId,learnerId,raw.teacherId,raw.cycleId,subject,
   raw.startsAtMs,Number(raw.startsAtMs)+SLOT_MS,now).run();
  // A resolved D1 call is not proof of persistence unless D1 acknowledges
  // a successful row change. Unknown outcomes must remain retryable with
  // the same operationId, never be reported as a confirmed proposal.
  if(write.success!==true||!Number.isSafeInteger(write.meta?.changes)||
   write.meta.changes<1)
   return {status:503,code:'ACADEMY_PAID_SLOT_WRITE_UNCONFIRMED'} as const;
 }catch(e){
  if(expected(e)){
   // An identical concurrent insert can win between SELECT and INSERT.
   // Only the exact same authorized operation may replay; other constraint
   // failures still deny without claiming a booking or credit spend.
   const raced=await findPrior();
   if(raced)return replay(raced);
   return {status:409,code:'ACADEMY_PAID_SLOT_DENIED'} as const;
  }
  throw e;
 }
 return {status:201,code:'ACADEMY_PAID_SLOT_CREATED',slotRequestId:id} as const;
}

export async function staffPaidSlotRequests(db:CoreDatabase,subject:string){
 if(!await canManageTeachers(db,subject))
  return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 const rows=await db.prepare(`SELECT r.id AS requestId,r.learner_id AS learnerId,
 l.display_name AS learnerName,r.teacher_id AS teacherId,
 u.name AS teacherName,r.starts_at_ms AS startsAtMs,
 r.ends_at_ms AS endsAtMs,
 CASE WHEN d.decision IS NULL THEN 'pending' ELSE d.decision END AS state,
 d.lesson_id AS lessonId
 FROM academy_paid_slot_request_events r
 JOIN learners l ON l.id=r.learner_id
 JOIN teachers t ON t.id=r.teacher_id
 JOIN auth_users u ON u.id=t.auth_subject
 LEFT JOIN academy_paid_slot_decision_events d ON d.request_id=r.id
 ORDER BY r.requested_at_ms DESC,r.id DESC LIMIT 100`)
 .all<Record<string,unknown>>();
 return {status:200,code:'ACADEMY_PAID_SLOT_STAFF',requests:rows.results} as const;
}

export async function staffPaidSlotDecision(db:CoreDatabase,subject:string,
 raw:unknown,now=Date.now()){
 if(!obj(raw)||!exact(raw,['operationId','requestId','decision','reason'])||
 !uuid(raw.operationId)||!uuid(raw.requestId)||
 (raw.decision!=='approved'&&raw.decision!=='rejected')||
 !reason(raw.reason)||!safeClock(now))
 return {status:400,code:'ACADEMY_PAID_SLOT_INVALID_DECISION'} as const;
 if(!await canManageTeachers(db,subject))
  return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 const findPrior=()=>db.prepare(`SELECT id,actor_subject AS actor,request_id AS requestId,
 decision,reason,lesson_id AS lessonId
 FROM academy_paid_slot_decision_events WHERE operation_id=?`)
 .bind(raw.operationId).first<{
 id:string;actor:string;requestId:string;decision:string;reason:string;lessonId:string|null
 }>();
 const replay=(prior:NonNullable<Awaited<ReturnType<typeof findPrior>>>)=>
  prior.actor===subject&&prior.requestId===raw.requestId&&
  prior.decision===raw.decision&&prior.reason===raw.reason?
  {status:200,code:'ACADEMY_PAID_SLOT_DECISION_REPLAY',lessonId:prior.lessonId} as const:
  {status:409,code:'ACADEMY_OPERATION_CONFLICT'} as const;
 const prior=await findPrior();
 if(prior)return replay(prior);
 const lessonId=raw.decision==='approved'?crypto.randomUUID():null;
 try{
  // One D1 INSERT; the SQL trigger atomically creates the lesson and spend.
  const write=await db.prepare(`INSERT INTO academy_paid_slot_decision_events
  (id,operation_id,request_id,actor_subject,decision,lesson_id,reason,at_ms)
  VALUES(?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),raw.operationId,
   raw.requestId,subject,raw.decision,lessonId,raw.reason,now).run();
  // Do not tell staff a lesson was booked or a unit spent if D1 did not
  // acknowledge a successful insert. An uncertain write is recoverable by
  // replaying the exact immutable operationId after a fresh role check.
  if(write.success!==true||!Number.isSafeInteger(write.meta?.changes)||
   write.meta.changes<1)
   return {status:503,code:'ACADEMY_PAID_SLOT_WRITE_UNCONFIRMED'} as const;
 }catch(e){
  if(expected(e)){
   // Preserve the original lessonId on an identical concurrent decision.
   // Authorization was freshly checked before both reads.
   const raced=await findPrior();
   if(raced)return replay(raced);
   return {status:409,code:'ACADEMY_PAID_SLOT_DECISION_DENIED'} as const;
  }
  throw e;
 }
 return {status:201,code:'ACADEMY_PAID_SLOT_DECIDED',lessonId} as const;
}
