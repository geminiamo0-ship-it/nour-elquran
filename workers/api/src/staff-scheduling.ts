import type {CoreDatabase} from './bindings.ts';
import {canManageTeachers} from './staff-teachers.ts';

export type ScheduleAction='assign'|'revoke'|'book'|'cancel';
export type ScheduleCommand=Readonly<{
 action:ScheduleAction;operationId:string;reason:string;
 learnerId?:string;teacherId?:string;startsAtMs?:number;endsAtMs?:number;
 kind?:'trial'|'standard'|'makeup';resourceId?:string;
}>;
const IDENTIFIER=/^[A-Za-z0-9_-]{1,128}$/;
const OPERATION=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KINDS=['trial','standard','makeup'];
const DURATION=40*60*1000;
const HORIZON=2*366*24*60*60*1000;
function exact(o:Record<string,unknown>,keys:readonly string[]):boolean {
 return Object.keys(o).length===keys.length && Object.keys(o).every(k=>keys.includes(k));
}
function textId(v:unknown):v is string {return typeof v==='string'&&IDENTIFIER.test(v);}
function safeTime(v:unknown):v is number {return typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;}
export function parseScheduleCommand(value:unknown,now=Date.now()):ScheduleCommand|null {
 if(!value||typeof value!=='object'||Array.isArray(value)||!safeTime(now))return null;
 const o=value as Record<string,unknown>;
 const {action,operationId,reason}=o;
 if(!['assign','revoke','book','cancel'].includes(String(action)) ||
   typeof operationId!=='string'||!OPERATION.test(operationId)||
   typeof reason!=='string'||reason.trim().length<8||reason.trim().length>500)return null;
 const common={action:action as ScheduleAction,operationId,reason:reason.trim()};
 if(action==='revoke'||action==='cancel') {
   if(!exact(o,['action','operationId','reason','resourceId'])||!textId(o.resourceId))return null;
   return {...common,resourceId:o.resourceId};
 }
 if(action==='assign') {
   if(!exact(o,['action','operationId','reason','learnerId','teacherId','startsAtMs','endsAtMs'])||
     !textId(o.learnerId)||!textId(o.teacherId)||!safeTime(o.startsAtMs)||
     !safeTime(o.endsAtMs)||o.startsAtMs<now||o.endsAtMs<=o.startsAtMs||
     o.endsAtMs>now+HORIZON)return null;
   return {...common,learnerId:o.learnerId,teacherId:o.teacherId,
     startsAtMs:o.startsAtMs,endsAtMs:o.endsAtMs};
 }
 if(!exact(o,['action','operationId','reason','learnerId','teacherId','startsAtMs','kind'])||
   !textId(o.learnerId)||!textId(o.teacherId)||!safeTime(o.startsAtMs)||
   o.startsAtMs<now||o.startsAtMs+DURATION>now+HORIZON||
   typeof o.kind!=='string'||!KINDS.includes(o.kind))return null;
 return {...common,learnerId:o.learnerId,teacherId:o.teacherId,
   startsAtMs:o.startsAtMs,endsAtMs:o.startsAtMs+DURATION,
   kind:o.kind as 'trial'|'standard'|'makeup'};
}

export const SCHEDULE_EVENT_LOOKUP_SQL=`
 SELECT actor_auth_subject AS actor,action,resource_id AS resourceId,
   learner_id AS learnerId,teacher_id AS teacherId,
   starts_at_ms AS startsAtMs,ends_at_ms AS endsAtMs,
   lesson_kind AS kind,reason
 FROM staff_schedule_events WHERE operation_id=?
`;
export const SCHEDULE_EVENT_INSERT_SQL=`
 INSERT INTO staff_schedule_events(
  id,operation_id,actor_auth_subject,action,resource_id,
  learner_id,teacher_id,starts_at_ms,ends_at_ms,lesson_kind,reason,at_ms
 ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
`;
type Stored=Readonly<{
 actor:string;action:ScheduleAction;resourceId:string;learnerId:string;
 teacherId:string;startsAtMs:number|null;endsAtMs:number|null;
 kind:string|null;reason:string;
}>;
type ScheduleResult=Readonly<{status:number;code:string;resourceId?:string;action?:ScheduleAction}>;
function equivalent(stored:Stored,actor:string,cmd:ScheduleCommand):boolean {
 return stored.actor===actor&&stored.action===cmd.action&&stored.reason===cmd.reason &&
  (cmd.resourceId===undefined||stored.resourceId===cmd.resourceId) &&
  stored.learnerId===(cmd.learnerId??'')&&stored.teacherId===(cmd.teacherId??'') &&
  stored.startsAtMs===(cmd.startsAtMs??null)&&stored.endsAtMs===(cmd.endsAtMs??null) &&
  stored.kind===(cmd.kind??null);
}
async function previous(db:CoreDatabase,operationId:string):Promise<Stored|null> {
 return db.prepare(SCHEDULE_EVENT_LOOKUP_SQL).bind(operationId).first<Stored>();
}
export async function executeStaffSchedule(
 db:CoreDatabase,actor:string,command:ScheduleCommand,now=Date.now(),
):Promise<ScheduleResult> {
 if(!Number.isSafeInteger(now)||now<0)return {status:503,code:'CLOCK_UNAVAILABLE'};
 if(!await canManageTeachers(db,actor))return {status:403,code:'STAFF_ACCESS_DENIED'};
 const before=await previous(db,command.operationId);
 if(before)return equivalent(before,actor,command)
   ? {status:200,code:'OPERATION_ALREADY_APPLIED',resourceId:before.resourceId,action:before.action}
   : {status:409,code:'OPERATION_ID_CONFLICT'};
 const resourceId=command.resourceId??crypto.randomUUID();
 try {
  // A single INSERT atomically applies the D1 trigger. Concurrent writer,
  // revoked grant, conflicting booking, missing assignment all fail closed.
  await db.prepare(SCHEDULE_EVENT_INSERT_SQL).bind(
   crypto.randomUUID(),command.operationId,actor,command.action,resourceId,
   command.learnerId??'',command.teacherId??'',command.startsAtMs??null,
   command.endsAtMs??null,command.kind??null,command.reason,now,
  ).run();
 } catch(error){
  const replay=await previous(db,command.operationId);
  if(replay)return equivalent(replay,actor,command)
    ? {status:200,code:'OPERATION_ALREADY_APPLIED',resourceId:replay.resourceId,action:replay.action}
    : {status:409,code:'OPERATION_ID_CONFLICT'};
  if(error instanceof Error&&/constraint|abort|conflict|assignment|lesson|unverified|booking|cancellation|schedule/i.test(error.message))
   return {status:409,code:'SCHEDULE_TRANSITION_DENIED'};
  throw error;
 }
 return {status:command.action==='assign'||command.action==='book'?201:200,
   code:'SCHEDULE_ACTION_APPLIED',resourceId,action:command.action};
}
