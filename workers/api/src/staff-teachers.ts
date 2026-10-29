import type { CoreDatabase } from './bindings.ts';

export type StaffTeacherAction = 'provision'|'qualify'|'activate'|'suspend'|'revoke_qualification';
export type TeacherActionInput = Readonly<{
  targetUserId:string; action:StaffTeacherAction; reason:string; operationId:string;
}>;
export type TeacherActionResult = Readonly<{
  status: number; code:string; teacherId?:string; qualified?:boolean; state?:'active'|'disabled';
}>;

// The staff member is obtained exclusively from a D1-validated Better Auth
// session. No owner/teacher role header, email or token is trusted from JSON.
export const VERIFIED_STAFF_MANAGE_SQL = `
 SELECT grant_row.auth_subject AS subject
 FROM staff_grants grant_row
 JOIN auth_users user ON user.id=grant_row.auth_subject
 JOIN accounts account ON account.auth_subject=user.id
 WHERE grant_row.auth_subject=?
   AND grant_row.permission='roles.manage'
   AND grant_row.revoked_at_ms IS NULL
   AND user.phone_number_verified=1 AND account.status='active'
 LIMIT 1
`;

const USER_ID=/^[A-Za-z0-9_-]{1,128}$/;
const OP_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS:readonly StaffTeacherAction[]=['provision','qualify','activate','suspend','revoke_qualification'];

export function parseTeacherAction(value:unknown):TeacherActionInput|null {
  if(!value || typeof value!=='object' || Array.isArray(value))return null;
  const data=value as Record<string,unknown>;
  const keys=Object.keys(data);
  if(keys.length!==4 || !keys.every(key=>['targetUserId','action','reason','operationId'].includes(key))
    || typeof data.targetUserId!=='string' || !USER_ID.test(data.targetUserId)
    || typeof data.action!=='string' || !ACTIONS.includes(data.action as StaffTeacherAction)
    || typeof data.reason!=='string' || data.reason.trim().length<8 || data.reason.trim().length>500
    || typeof data.operationId!=='string' || !OP_ID.test(data.operationId))return null;
  return {targetUserId:data.targetUserId,action:data.action as StaffTeacherAction,
    reason:data.reason.trim(),operationId:data.operationId};
}

type PriorEvent={actor_auth_subject:string;target_auth_subject:string;teacher_id:string;
  action:string;reason:string};
export async function canManageTeachers(db:CoreDatabase, verifiedAuthSubject:string):Promise<boolean> {
  if(!verifiedAuthSubject || !USER_ID.test(verifiedAuthSubject))return false;
  const row=await db.prepare(VERIFIED_STAFF_MANAGE_SQL)
    .bind(verifiedAuthSubject).first<{subject:string}>();
  return row?.subject===verifiedAuthSubject;
}

export async function issueTeacherRoleAction(
  db:CoreDatabase, verifiedStaffSubject:string, input:TeacherActionInput, now=Date.now(),
):Promise<TeacherActionResult> {
  if(!Number.isSafeInteger(now)||now<0)return {status:503,code:'CLOCK_UNAVAILABLE'};
  // Read again immediately before writing. The D1 trigger independently rechecks
  // staff grant atomically, so a concurrent revocation denies the command.
  if(!await canManageTeachers(db,verifiedStaffSubject))
    return {status:403,code:'STAFF_ACCESS_DENIED'};
  const prior=await db.prepare(
    'SELECT actor_auth_subject,target_auth_subject,teacher_id,action,reason FROM teacher_role_events WHERE operation_id=?',
  ).bind(input.operationId).first<PriorEvent>();
  if(prior) {
    const same=prior.actor_auth_subject===verifiedStaffSubject &&
      prior.target_auth_subject===input.targetUserId && prior.action===input.action &&
      prior.reason===input.reason;
    return same
      ? {status:200,code:'OPERATION_ALREADY_APPLIED',teacherId:prior.teacher_id}
      : {status:409,code:'OPERATION_ID_CONFLICT'};
  }
  const existing=await db.prepare('SELECT id FROM teachers WHERE auth_subject=?')
    .bind(input.targetUserId).first<{id:string}>();
  if(input.action!=='provision' && !existing)
    return {status:404,code:'TEACHER_NOT_FOUND'};
  // Provision is always dormant. Every additional transition is independently
  // approved by staff and checked by database triggers on the same insert.
  const teacherId=existing?.id??crypto.randomUUID();
  try {
    await db.prepare(
      'INSERT INTO teacher_role_events(id,operation_id,teacher_id,actor_auth_subject,target_auth_subject,action,reason,at_ms) VALUES(?,?,?,?,?,?,?,?)',
    ).bind(crypto.randomUUID(),input.operationId,teacherId,verifiedStaffSubject,
      input.targetUserId,input.action,input.reason,now).run();
  } catch(error) {
    // Unique-operation collision on parallel requests returns an idempotent
    // response; all other constraint/transition failures fail closed.
    const retry=await db.prepare(
      'SELECT actor_auth_subject,target_auth_subject,teacher_id,action,reason FROM teacher_role_events WHERE operation_id=?',
    ).bind(input.operationId).first<PriorEvent>();
    if(retry){
      const same=retry.actor_auth_subject===verifiedStaffSubject &&
        retry.target_auth_subject===input.targetUserId && retry.action===input.action &&
        retry.reason===input.reason;
      return same?{status:200,code:'OPERATION_ALREADY_APPLIED',teacherId:retry.teacher_id}:
        {status:409,code:'OPERATION_ID_CONFLICT'};
    }
    if(error instanceof Error && /constraint|denied|immutable|mismatch|provisioned|verified|grant/i.test(error.message))
      return {status:409,code:'TEACHER_ROLE_TRANSITION_DENIED'};
    throw error;
  }
  const row=await db.prepare('SELECT id,qualified,status FROM teachers WHERE id=? AND auth_subject=?')
    .bind(teacherId,input.targetUserId).first<{id:string;qualified:number;status:'active'|'disabled'}>();
  if(!row)throw Error('Teacher role event did not apply');
  return {status:input.action==='provision'?201:200,code:'TEACHER_ROLE_CHANGED',
    teacherId:row.id,qualified:row.qualified===1,state:row.status};
}
