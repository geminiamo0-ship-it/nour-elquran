/** #309: Resolve teacher roster IDs only on the trusted D1 server;
 * no Better Auth subject is sent to the browser.
 */
import type {CoreDatabase} from './bindings.ts';
import {canManageTeachers,issueTeacherRoleAction} from './staff-teachers.ts';
const ID=/^[a-zA-Z0-9-]{1,128}$/;
const OP=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowed=['qualify','activate','suspend','revoke_qualification'] as const;
export type Transition=Readonly<{
 teacherId:string;action:typeof allowed[number];reason:string;operationId:string;
}>;
export function parseTeacherTransition(raw:unknown):Transition|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const x=raw as Record<string,unknown>;
 if(Object.keys(x).length!==4||!['teacherId','action','reason','operationId']
  .every(k=>Object.hasOwn(x,k))||typeof x.teacherId!=='string'||
  !ID.test(x.teacherId)||typeof x.action!=='string'||
  !allowed.includes(x.action as Transition['action'])||
  typeof x.reason!=='string'||x.reason.trim().length<8||
  x.reason.trim().length>500||x.reason!==x.reason.trim()||
  typeof x.operationId!=='string'||!OP.test(x.operationId))return null;
 return {teacherId:x.teacherId,action:x.action as Transition['action'],
  reason:x.reason,operationId:x.operationId};
}
export async function transitionListedTeacher(db:CoreDatabase,staffSubject:string,
 raw:unknown,now=Date.now()){
 const command=parseTeacherTransition(raw);
 if(!command)return {status:400,code:'INVALID_TEACHER_TRANSITION'} as const;
 if(!await canManageTeachers(db,staffSubject))
  return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 const teacher=await db.prepare('SELECT auth_subject AS subject FROM teachers WHERE id=?')
  .bind(command.teacherId).first<{subject:string}>();
 if(!teacher||!ID.test(teacher.subject))
  return {status:404,code:'TEACHER_NOT_FOUND'} as const;
 if(command.action==='suspend'||command.action==='revoke_qualification'){
  const active=await db.prepare('SELECT 1 AS pending FROM lessons WHERE actual_teacher_id=? AND (status=\'live\' OR (status=\'scheduled\' AND ends_at_ms>?)) LIMIT 1')
   .bind(command.teacherId,now).first<{pending:number}>();
  if(active)return {status:409,code:'ACTIVE_CLASSES_BLOCK_TRANSITION'} as const;
 }
 return issueTeacherRoleAction(db,staffSubject,{
  targetUserId:teacher.subject,action:command.action,
  operationId:command.operationId,reason:command.reason,
 },now);
}
