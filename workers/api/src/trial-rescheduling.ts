/** #244: atomic, owner-scoped first free-trial rescheduling.
 * The new lesson and cancellation must share one D1 INSERT transaction.
 * No new trial, credit charge, teacher choice, or client-supplied actor.
 */
import type {CoreDatabase} from './bindings.ts';
import {verifiedOwner} from './published-assignments.ts';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const childId=/^[A-Za-z0-9_-]{1,128}$/;
const SIX_HOURS=21600000;
const MONTH=2592000000;
export type RescheduleCommand=Readonly<{operationId:string;oldLessonId:string;slotId:string}>;
export function parseTrialReschedule(raw:unknown):RescheduleCommand|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const obj=raw as Record<string,unknown>;
 if(Object.keys(obj).length!==3||
  !['operationId','oldLessonId','slotId'].every(x=>Object.hasOwn(obj,x))||
  ![obj.operationId,obj.oldLessonId,obj.slotId].every(x=>typeof x==='string'&&uuid.test(x)))
  return null;
 return obj as RescheduleCommand;
}
type Existing={lessonId:string;startsAtMs:number;slotId:string};
async function currentTrial(db:CoreDatabase,learnerId:string,lessonId:string){
 return db.prepare(`SELECT l.id AS lessonId,l.starts_at_ms AS startsAtMs,
  b.slot_id AS slotId FROM lessons l
 JOIN trial_booking_events b ON b.lesson_id=l.id
 WHERE l.id=? AND l.learner_id=? AND l.kind='trial' AND l.status='scheduled'`)
 .bind(lessonId,learnerId).first<Existing>();
}
async function ownerAndCurrent(db:CoreDatabase,subject:string,learnerId:string,
 lessonId:string,now:number){
 if(!childId.test(learnerId)||!uuid.test(lessonId)||
    !await verifiedOwner(db,subject,learnerId))
  return {status:404,code:'NOT_FOUND'} as const;
 const old=await currentTrial(db,learnerId,lessonId);
 if(!old)return {status:404,code:'NOT_FOUND'} as const;
 if(old.startsAtMs<now+SIX_HOURS)
  return {status:409,code:'TRIAL_RESCHEDULE_TOO_LATE'} as const;
 return {status:200,code:'TRIAL_RESCHEDULE_ALLOWED',old} as const;
}

export async function listOwnerRescheduleSlots(db:CoreDatabase,subject:string,
 learnerId:string,oldLessonId:string,now=Date.now()){
 const check=await ownerAndCurrent(db,subject,learnerId,oldLessonId,now);
 if(check.status!==200)return check;
 type Slot={slotId:string;startsAtMs:number;endsAtMs:number};
 const rows=await db.prepare(`SELECT s.id AS slotId,s.starts_at_ms AS startsAtMs,
 s.ends_at_ms AS endsAtMs FROM trial_open_slot_events s
 JOIN teachers teacher ON teacher.id=s.teacher_id
 WHERE s.id<>? AND teacher.status='active' AND teacher.qualified=1
 AND s.starts_at_ms>=? AND s.starts_at_ms<=?
 AND NOT EXISTS(SELECT 1 FROM trial_slot_closure_events c WHERE c.slot_id=s.id)
 AND NOT EXISTS(SELECT 1 FROM lessons l
  WHERE l.id<>? AND l.status<>'cancelled'
   AND (l.actual_teacher_id=s.teacher_id OR l.learner_id=?)
   AND l.starts_at_ms<s.ends_at_ms AND s.starts_at_ms<l.ends_at_ms)
 AND NOT EXISTS(SELECT 1 FROM teacher_assignments a
  WHERE a.learner_id=? AND a.teacher_id<>s.teacher_id
   AND a.revoked_at_ms IS NULL
   AND a.starts_at_ms<s.ends_at_ms AND s.starts_at_ms<a.ends_at_ms
   AND NOT EXISTS(SELECT 1 FROM trial_booking_auto_grants auto
    JOIN trial_booking_events booked ON booked.id=auto.booking_id
    WHERE booked.lesson_id=? AND auto.assignment_id=a.id))
 ORDER BY s.starts_at_ms,s.id LIMIT 50`)
 .bind(check.old.slotId,now,now+MONTH,oldLessonId,learnerId,learnerId,oldLessonId)
 .all<Slot>();
 return {status:200,code:'TRIAL_RESCHEDULE_SLOTS',
  slots:rows.results.map(slot=>({...slot,instructionMinutes:30,reservationMinutes:40}))} as const;
}
type Saved={old_lesson_id:string;new_lesson_id:string;new_slot_id:string;
 learner_id:string;actor_subject:string};
export async function rescheduleOwnerTrial(db:CoreDatabase,subject:string,
 learnerId:string,raw:unknown,now=Date.now()){
 const cmd=parseTrialReschedule(raw);
 if(!cmd)return {status:400,code:'INVALID_TRIAL_RESCHEDULE'} as const;
 if(!childId.test(learnerId)||!await verifiedOwner(db,subject,learnerId))
  return {status:404,code:'NOT_FOUND'} as const;
 const find=()=>db.prepare(`SELECT old_lesson_id,new_lesson_id,new_slot_id,
  learner_id,actor_subject FROM trial_owner_reschedule_events WHERE operation_id=?`)
  .bind(cmd.operationId).first<Saved>();
 const replay=(s:Saved)=>s.old_lesson_id===cmd.oldLessonId&&
  s.new_slot_id===cmd.slotId&&s.learner_id===learnerId&&s.actor_subject===subject?
  {status:200,code:'TRIAL_RESCHEDULE_REPLAY',lessonId:s.new_lesson_id} as const:
  {status:409,code:'TRIAL_OPERATION_CONFLICT'} as const;
 const already=await find();
 if(already)return replay(already);
 const check=await ownerAndCurrent(db,subject,learnerId,cmd.oldLessonId,now);
 if(check.status!==200)return check;
 const lessonId=crypto.randomUUID();
 try{
  await db.prepare(`INSERT INTO trial_owner_reschedule_events
   (id,operation_id,old_lesson_id,new_lesson_id,new_slot_id,
    learner_id,actor_subject,at_ms) VALUES(?,?,?,?,?,?,?,?)`)
  .bind(crypto.randomUUID(),cmd.operationId,cmd.oldLessonId,lessonId,
   cmd.slotId,learnerId,subject,now).run();
 }catch(e){
  const raced=await find();
  if(raced)return replay(raced);
  if(e instanceof Error&&/constraint|TRIAL_|UNIQUE|FOREIGN KEY|abort/i.test(e.message))
   return {status:409,code:'TRIAL_RESCHEDULE_UNAVAILABLE'} as const;
  throw e;
 }
 return {status:201,code:'TRIAL_RESCHEDULED',lessonId} as const;
}
