/** #244 Source-backed free 30m trial over a 40m D1 booking.
 * Do not infer trial eligibility, teacher identity, payment, or credits in UI.
 */
import type {CoreDatabase} from './bindings.ts';
import {canManageTeachers} from './staff-teachers.ts';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id=/^[A-Za-z0-9_-]{1,128}$/;
const SLOT_MS=2400000,MONTH_MS=2592000000;
const isObject=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x:Record<string,unknown>,keys:readonly string[])=>Object.keys(x).length===keys.length&&
 keys.every(k=>Object.hasOwn(x,k));
export type TrialSlotCommand=Readonly<{operationId:string;teacherId:string;startsAtMs:number}>;
export type TrialBookingCommand=Readonly<{operationId:string;slotId:string}>;
export function parseTrialSlotCommand(raw:unknown):TrialSlotCommand|null{
 if(!isObject(raw)||!exact(raw,['operationId','teacherId','startsAtMs'])||
  typeof raw.operationId!=='string'||!uuid.test(raw.operationId)||
  typeof raw.teacherId!=='string'||!id.test(raw.teacherId)||
  !Number.isSafeInteger(raw.startsAtMs)||Number(raw.startsAtMs)<0)return null;
 return raw as TrialSlotCommand;
}
export function parseTrialBookingCommand(raw:unknown):TrialBookingCommand|null{
 if(!isObject(raw)||!exact(raw,['operationId','slotId'])||
  typeof raw.operationId!=='string'||!uuid.test(raw.operationId)||
  typeof raw.slotId!=='string'||!uuid.test(raw.slotId))return null;
 return raw as TrialBookingCommand;
}
type Published={id:string;actor_subject:string;teacher_id:string;starts_at_ms:number};
type Booked={lesson_id:string;slot_id:string;learner_id:string;actor_subject:string};
export async function publishTrialSlot(db:CoreDatabase,subject:string,raw:unknown,now=Date.now()){
 const c=parseTrialSlotCommand(raw);
 if(!c)return {status:400,code:'INVALID_TRIAL_SLOT'} as const;
 if(!await canManageTeachers(db,subject))
  return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 const prior=()=>db.prepare(`SELECT id,actor_subject,teacher_id,starts_at_ms
  FROM trial_open_slot_events WHERE operation_id=?`)
  .bind(c.operationId).first<Published>();
 const p=await prior();
 const replay=(v:Published)=>v.actor_subject===subject&&v.teacher_id===c.teacherId&&
  v.starts_at_ms===c.startsAtMs?
  {status:200,code:'TRIAL_SLOT_ALREADY_OPEN',slotId:v.id} as const:
  {status:409,code:'TRIAL_OPERATION_CONFLICT'} as const;
 if(p)return replay(p);
 if(c.startsAtMs<now||c.startsAtMs>now+MONTH_MS-SLOT_MS)
  return {status:400,code:'TRIAL_SLOT_OUTSIDE_WINDOW'} as const;
 const slotId=crypto.randomUUID();
 try{
  await db.prepare(`INSERT INTO trial_open_slot_events(id,operation_id,actor_subject,
   teacher_id,starts_at_ms,ends_at_ms,published_at_ms)
   VALUES(?,?,?,?,?,?,?)`).bind(slotId,c.operationId,subject,c.teacherId,
    c.startsAtMs,c.startsAtMs+SLOT_MS,now).run();
 }catch(e){
  const raced=await prior();
  if(raced)return replay(raced);
  if(e instanceof Error&&/constraint|TRIAL_|abort|UNIQUE/i.test(e.message))
   return {status:409,code:'TRIAL_SLOT_UNAVAILABLE'} as const;
  throw e;
 }
 return {status:201,code:'TRIAL_SLOT_OPENED',slotId} as const;
}
async function verifiedOwner(db:CoreDatabase,subject:string,learnerId:string){
 if(!id.test(learnerId))return false;
 const row=await db.prepare(`SELECT 1 AS allowed FROM learners l JOIN accounts a
  ON a.id=l.account_id WHERE l.id=? AND a.auth_subject=?
   AND l.status='active' AND a.status='active'`).bind(learnerId,subject).first<{allowed:number}>();
 return row?.allowed===1;
}
async function usedTrial(db:CoreDatabase,learnerId:string){
 const row=await db.prepare(`SELECT 1 AS used FROM lessons l
  WHERE l.learner_id=? AND l.kind='trial' AND l.status<>'cancelled' LIMIT 1`)
 .bind(learnerId).first<{used:number}>();
 return row?.used===1;
}
export async function listOwnerTrialSlots(db:CoreDatabase,subject:string,learnerId:string,
 now=Date.now()){
 if(!await verifiedOwner(db,subject,learnerId))
  return {status:404,code:'NOT_FOUND'} as const;
 if(await usedTrial(db,learnerId))
  return {status:200,code:'TRIAL_SLOTS',eligible:false,slots:[]} as const;
 type Slot={slotId:string;startsAtMs:number;endsAtMs:number};
 const res=await db.prepare(`SELECT s.id AS slotId,s.starts_at_ms AS startsAtMs,
  s.ends_at_ms AS endsAtMs FROM trial_open_slot_events s
 JOIN teachers t ON t.id=s.teacher_id
 WHERE t.status='active' AND t.qualified=1
 AND s.starts_at_ms>=? AND s.ends_at_ms<=?
 AND NOT EXISTS(SELECT 1 FROM lessons l
  WHERE l.status<>'cancelled' AND
   (l.actual_teacher_id=s.teacher_id OR l.learner_id=?)
    AND l.starts_at_ms<s.ends_at_ms AND s.starts_at_ms<l.ends_at_ms)
 AND NOT EXISTS(SELECT 1 FROM teacher_assignments g
  WHERE g.learner_id=? AND g.teacher_id<>s.teacher_id
   AND g.revoked_at_ms IS NULL AND g.starts_at_ms<s.ends_at_ms
   AND s.starts_at_ms<g.ends_at_ms)
 ORDER BY s.starts_at_ms ASC,s.id ASC LIMIT 50`)
 .bind(now,now+MONTH_MS,learnerId,learnerId).all<Slot>();
 return {status:200,code:'TRIAL_SLOTS',eligible:true,slots:res.results.map(x=>({
  ...x,instructionMinutes:30,reservationMinutes:40
 }))} as const;
}
export async function bookOwnerTrial(db:CoreDatabase,subject:string,learnerId:string,
 raw:unknown,now=Date.now()){
 const c=parseTrialBookingCommand(raw);
 if(!c)return {status:400,code:'INVALID_TRIAL_BOOKING'} as const;
 if(!await verifiedOwner(db,subject,learnerId))
  return {status:404,code:'NOT_FOUND'} as const;
 const prior=()=>db.prepare(`SELECT lesson_id,slot_id,learner_id,actor_subject
  FROM trial_booking_events WHERE operation_id=?`).bind(c.operationId).first<Booked>();
 const replay=(p:Booked)=>p.actor_subject===subject&&p.learner_id===learnerId&&
  p.slot_id===c.slotId?
  {status:200,code:'TRIAL_BOOKING_REPLAY',lessonId:p.lesson_id} as const:
  {status:409,code:'TRIAL_OPERATION_CONFLICT'} as const;
 const p=await prior();
 if(p)return replay(p);
 const slot=await db.prepare(`SELECT id,starts_at_ms AS startsAtMs FROM trial_open_slot_events
  WHERE id=?`).bind(c.slotId).first<{id:string;startsAtMs:number}>();
 if(!slot||slot.startsAtMs<now||slot.startsAtMs>now+MONTH_MS)
  return {status:409,code:'TRIAL_SLOT_UNAVAILABLE'} as const;
 const lessonId=crypto.randomUUID();
 try{
  // One D1 source row atomically creates teacher assignment (when needed),
  // lesson and derived inbox events via SQLite trigger transaction.
  await db.prepare(`INSERT INTO trial_booking_events(id,operation_id,lesson_id,
   slot_id,learner_id,actor_subject,booked_at_ms) VALUES(?,?,?,?,?,?,?)`)
  .bind(crypto.randomUUID(),c.operationId,lessonId,c.slotId,learnerId,subject,now).run();
 }catch(e){
  const raced=await prior();
  if(raced)return replay(raced);
  if(e instanceof Error&&/constraint|TRIAL_|teacher|learner|booking|assignment/i.test(e.message))
   return {status:409,code:'TRIAL_SLOT_UNAVAILABLE'} as const;
  throw e;
 }
 return {status:201,code:'TRIAL_BOOKED',lessonId} as const;
}
