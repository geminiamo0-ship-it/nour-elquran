/** #315: Staff-confirmed trial and paid bookings; atomic D1 event triggers.
 * No direct browser payment, auto-charge, or secondary subscription ledger.
 */
import type {CoreDatabase} from './bindings.ts';
import {canManageTeachers} from './staff-teachers.ts';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuid=(x:unknown):x is string=>typeof x==='string'&&UUID.test(x);
const obj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const exact=(x:Record<string,unknown>,k:readonly string[])=>Object.keys(x).length===k.length&&k.every(t=>Object.hasOwn(x,t));
const reason=(x:unknown)=>typeof x==='string'&&x.trim()===x&&x.length>=8&&x.length<=500;
const expected=(e:unknown)=>e instanceof Error&&/constraint|abort|ACADEMY_|TRIAL_|SUBSCRIPTION_|UNIQUE/i.test(e.message);
async function owned(db:CoreDatabase,who:string,child:string){
 if(!uuid(child))return false;
 const r=await db.prepare(`SELECT 1 AS allowed FROM learners l JOIN accounts a ON a.id=l.account_id
 WHERE l.id=? AND a.auth_subject=? AND l.status='active' AND a.status='active'`)
 .bind(child,who).first<{allowed:number}>();
 return r?.allowed===1;
}
export async function ownerTrialRequest(db:CoreDatabase,subject:string,child:string,
 raw:unknown,now=Date.now()){
 if(!obj(raw)||!exact(raw,['operationId','slotId'])||
 !uuid(raw.operationId)||!uuid(raw.slotId))
 return {status:400,code:'ACADEMY_TRIAL_INVALID'} as const;
 if(!await owned(db,subject,child))return {status:404,code:'NOT_FOUND'} as const;
 const previous=await db.prepare(`SELECT id,learner_id AS learnerId,actor_subject AS actor,
 slot_id AS slotId FROM academy_trial_request_events WHERE operation_id=?`)
 .bind(raw.operationId).first<{id:string;learnerId:string;actor:string;slotId:string}>();
 if(previous)return previous.learnerId===child&&previous.actor===subject&&previous.slotId===raw.slotId?
 {status:200,code:'ACADEMY_TRIAL_REPLAY',requestId:previous.id} as const:
 {status:409,code:'ACADEMY_TRIAL_OPERATION_CONFLICT'} as const;
 const id=crypto.randomUUID();
 try{await db.prepare(`INSERT INTO academy_trial_request_events
 (id,operation_id,learner_id,slot_id,actor_subject,requested_at_ms)
 VALUES(?,?,?,?,?,?)`).bind(id,raw.operationId,child,raw.slotId,subject,now).run();}
 catch(e){if(expected(e))return {status:409,code:'ACADEMY_TRIAL_REQUEST_DENIED'} as const;throw e;}
 return {status:201,code:'ACADEMY_TRIAL_REQUESTED',requestId:id} as const;
}
export async function ownerTrialRequests(db:CoreDatabase,subject:string,child:string){
 if(!await owned(db,subject,child))return {status:404,code:'NOT_FOUND'} as const;
 const rows=await db.prepare(`SELECT r.id AS requestId,s.starts_at_ms AS startsAtMs,
 CASE WHEN d.decision IS NOT NULL THEN d.decision ELSE 'pending' END AS state,
 d.lesson_id AS lessonId
 FROM academy_trial_request_events r JOIN trial_open_slot_events s ON s.id=r.slot_id
 LEFT JOIN academy_trial_decision_events d ON d.request_id=r.id
 WHERE r.learner_id=? ORDER BY r.requested_at_ms DESC,r.id DESC LIMIT 20`)
 .bind(child).all<Record<string,unknown>>();
 return {status:200,code:'ACADEMY_TRIAL_REQUESTS',requests:rows.results} as const;
}
export async function staffTrialRequests(db:CoreDatabase,subject:string){
 if(!await canManageTeachers(db,subject))return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 const rows=await db.prepare(`SELECT req.id AS requestId,req.learner_id AS learnerId,
 l.display_name AS learnerName,s.starts_at_ms AS startsAtMs,
 t.id AS teacherId,u.name AS teacherName,
 CASE WHEN d.decision IS NOT NULL THEN d.decision ELSE 'pending' END AS state,
 d.lesson_id AS lessonId
 FROM academy_trial_request_events req JOIN learners l ON l.id=req.learner_id
 JOIN trial_open_slot_events s ON s.id=req.slot_id JOIN teachers t ON t.id=s.teacher_id
 JOIN auth_users u ON u.id=t.auth_subject
 LEFT JOIN academy_trial_decision_events d ON d.request_id=req.id
 ORDER BY req.requested_at_ms DESC,req.id DESC LIMIT 100`).all<Record<string,unknown>>();
 return {status:200,code:'ACADEMY_TRIAL_STAFF',requests:rows.results} as const;
}
export async function staffTrialDecision(db:CoreDatabase,subject:string,raw:unknown,now=Date.now()){
 if(!obj(raw)||!exact(raw,['operationId','requestId','decision','reason'])||
 !uuid(raw.operationId)||!uuid(raw.requestId)||
 !['approved','rejected'].includes(String(raw.decision))||!reason(raw.reason))
 return {status:400,code:'ACADEMY_TRIAL_INVALID_DECISION'} as const;
 if(!await canManageTeachers(db,subject))return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 const prev=await db.prepare(`SELECT id,actor_subject AS actor,request_id AS requestId,
 decision,reason FROM academy_trial_decision_events WHERE operation_id=?`)
 .bind(raw.operationId).first<{id:string;actor:string;requestId:string;decision:string;reason:string}>();
 if(prev)return prev.actor===subject&&prev.requestId===raw.requestId&&
  prev.decision===raw.decision&&prev.reason===raw.reason?
  {status:200,code:'ACADEMY_TRIAL_DECISION_REPLAY'} as const:
  {status:409,code:'ACADEMY_TRIAL_OPERATION_CONFLICT'} as const;
 const lessonId=raw.decision==='approved'?crypto.randomUUID():null;
 try{await db.prepare(`INSERT INTO academy_trial_decision_events
 (id,operation_id,request_id,actor_subject,decision,lesson_id,reason,at_ms)
 VALUES(?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),raw.operationId,raw.requestId,
 subject,raw.decision,lessonId,raw.reason,now).run();}
 catch(e){if(expected(e))return {status:409,code:'ACADEMY_TRIAL_APPROVAL_DENIED'} as const;throw e;}
 return {status:201,code:'ACADEMY_TRIAL_DECIDED',lessonId} as const;
}
export async function staffPaidBooking(db:CoreDatabase,subject:string,raw:unknown,now=Date.now()){
 if(!obj(raw)||!exact(raw,['operationId','learnerId','teacherId','cycleId','startsAtMs','reason'])||
 !uuid(raw.operationId)||!uuid(raw.learnerId)||!uuid(raw.teacherId)||!uuid(raw.cycleId)||
 !Number.isSafeInteger(raw.startsAtMs)||Number(raw.startsAtMs)<now+60000||
 Number(raw.startsAtMs)>now+30*86400000||!reason(raw.reason))
 return {status:400,code:'ACADEMY_PAID_BOOKING_INVALID'} as const;
 if(!await canManageTeachers(db,subject))return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 const old=await db.prepare(`SELECT lesson_id AS lessonId,learner_id AS learnerId,
 teacher_id AS teacherId,cycle_id AS cycleId,starts_at_ms AS startsAtMs,
 actor_subject AS actor,reason FROM academy_paid_booking_events WHERE operation_id=?`)
 .bind(raw.operationId).first<{lessonId:string;learnerId:string;teacherId:string;
 cycleId:string;startsAtMs:number;actor:string;reason:string}>();
 if(old)return old.actor===subject&&old.learnerId===raw.learnerId&&
 old.teacherId===raw.teacherId&&old.cycleId===raw.cycleId&&
 old.startsAtMs===raw.startsAtMs&&old.reason===raw.reason?
 {status:200,code:'ACADEMY_PAID_BOOKING_REPLAY',lessonId:old.lessonId} as const:
 {status:409,code:'ACADEMY_OPERATION_CONFLICT'} as const;
 const lessonId=crypto.randomUUID();
 try{await db.prepare(`INSERT INTO academy_paid_booking_events
 (id,operation_id,lesson_id,learner_id,teacher_id,cycle_id,actor_subject,
 starts_at_ms,ends_at_ms,reason,at_ms) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
 .bind(crypto.randomUUID(),raw.operationId,lessonId,raw.learnerId,raw.teacherId,
 raw.cycleId,subject,raw.startsAtMs,Number(raw.startsAtMs)+2400000,
 raw.reason,now).run();}
 catch(e){if(expected(e))return {status:409,code:'ACADEMY_PAID_BOOKING_DENIED'} as const;throw e;}
 return {status:201,code:'ACADEMY_PAID_BOOKED',lessonId} as const;
}
export async function staffBookableCycles(db:CoreDatabase,subject:string){
 if(!await canManageTeachers(db,subject))return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 const cycles=await db.prepare(`SELECT c.id AS cycleId,c.learner_id AS learnerId,
 l.display_name AS learnerName,c.starts_at_ms AS startsAtMs,c.ends_at_ms AS endsAtMs,
 c.base_sessions+c.rollover_sessions-(SELECT COUNT(*) FROM subscription_spend_events e
 WHERE e.source_kind='cycle' AND e.source_id=c.id) AS remaining
 FROM subscription_cycles c JOIN learners l ON l.id=c.learner_id
 ORDER BY c.starts_at_ms DESC,c.id DESC LIMIT 100`).all<Record<string,unknown>>();
 return {status:200,code:'ACADEMY_CYCLES',cycles:cycles.results} as const;
}
