import type {CoreDatabase} from './bindings.ts';

export type AcademicLevel = 'beginner'|'intermediate'|'advanced';
export type AcademicPlan = Readonly<{
  level:AcademicLevel; nextWird:string; revisionWird:string; focus:string;
  revision:number; updatedAtMs:number;
}>;
export type PlanAction = Readonly<{
  operationId:string;expectedRevision:number;level:AcademicLevel;
  nextWird:string;revisionWird:string;focus:string;
}>;
type PlanRow={level:AcademicLevel;next_wird:string;revision_wird:string;focus:string;
 revision:number;updated_at_ms:number};
type EventRow={learner_id:string;actor_auth_subject:string;expected_revision:number;
 level:AcademicLevel;next_wird:string;revision_wird:string;focus:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const levels=['beginner','intermediate','advanced'];
function safeText(value:unknown,max:number):value is string {
 return typeof value==='string'&&value.trim().length>0&&value.trim().length<=max &&
   !Array.from(value).some(char=>{const code=char.charCodeAt(0);return code<32&&code!==9&&code!==10&&code!==13;});
}
export function parsePlanAction(raw:unknown):PlanAction|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const input=raw as Record<string,unknown>,keys=['operationId','expectedRevision','level','nextWird','revisionWird','focus'];
 if(Object.keys(input).length!==keys.length||!keys.every(key=>key in input)||
    !uuid.test(String(input.operationId))||!Number.isSafeInteger(input.expectedRevision)||
    Number(input.expectedRevision)<0||!levels.includes(String(input.level))||
    !safeText(input.nextWird,300)||!safeText(input.revisionWird,500)||!safeText(input.focus,500))return null;
 return {operationId:input.operationId as string,expectedRevision:input.expectedRevision as number,
    level:input.level as AcademicLevel,nextWird:(input.nextWird as string).trim(),
    revisionWird:(input.revisionWird as string).trim(),focus:(input.focus as string).trim()};
}
function toPlan(row:PlanRow|null):AcademicPlan|null {
 return row?{level:row.level,nextWird:row.next_wird,revisionWird:row.revision_wird,
  focus:row.focus,revision:row.revision,updatedAtMs:row.updated_at_ms}:null;
}
async function getPlan(db:CoreDatabase,learnerId:string) {
 return toPlan(await db.prepare(
   'SELECT level,next_wird,revision_wird,focus,revision,updated_at_ms FROM learner_academic_plans WHERE learner_id=?'
 ).bind(learnerId).first<PlanRow>());
}
async function permittedTeacher(db:CoreDatabase,subject:string,learnerId:string,at:number) {
 const row=await db.prepare(`SELECT 1 AS permitted FROM learners l
 JOIN accounts owner ON owner.id=l.account_id
 JOIN teacher_assignments assignment ON assignment.learner_id=l.id
 JOIN teachers teacher ON teacher.id=assignment.teacher_id
 WHERE l.id=? AND l.status='active' AND owner.status='active'
   AND teacher.auth_subject=? AND teacher.status='active' AND teacher.qualified=1
   AND assignment.revoked_at_ms IS NULL AND assignment.starts_at_ms<=? AND assignment.ends_at_ms>?
 LIMIT 1`).bind(learnerId,subject,at,at).first<{permitted:number}>();
 return row?.permitted===1;
}
export async function readTeacherPlan(db:CoreDatabase,subject:string,learnerId:string,now=Date.now()){
 if(!await permittedTeacher(db,subject,learnerId,now))return {status:404,code:'NOT_FOUND'} as const;
 return {status:200,plan:await getPlan(db,learnerId)} as const;
}
export async function readOwnerPlan(db:CoreDatabase,subject:string,learnerId:string){
 const owned=await db.prepare(`SELECT 1 AS permitted FROM learners l JOIN accounts a ON a.id=l.account_id
 WHERE l.id=? AND l.status='active' AND a.status='active' AND a.auth_subject=? LIMIT 1`)
 .bind(learnerId,subject).first<{permitted:number}>();
 if(owned?.permitted!==1)return {status:404,code:'NOT_FOUND'} as const;
 return {status:200,plan:await getPlan(db,learnerId)} as const;
}
export async function writeTeacherPlan(db:CoreDatabase,subject:string,learnerId:string,command:PlanAction){
 const find=()=>db.prepare(`SELECT learner_id,actor_auth_subject,expected_revision,level,
  next_wird,revision_wird,focus FROM academic_plan_events WHERE operation_id=? LIMIT 1`)
  .bind(command.operationId).first<EventRow>();
 const replay=(event:EventRow)=>{
   if(event.learner_id!==learnerId||event.actor_auth_subject!==subject)return {status:404,code:'NOT_FOUND'} as const;
   if(event.expected_revision!==command.expectedRevision||event.level!==command.level||
      event.next_wird!==command.nextWird||event.revision_wird!==command.revisionWird||
      event.focus!==command.focus)return {status:409,code:'PLAN_OPERATION_CONFLICT'} as const;
   return {status:200,code:'PLAN_ALREADY_SAVED',revision:command.expectedRevision+1} as const;
 };
 const now=Date.now();
 // A revoked or expired teacher must not replay a historical successful op.
 if(!await permittedTeacher(db,subject,learnerId,now))return {status:404,code:'NOT_FOUND'} as const;
 const current=await find();
 if(current)return replay(current);
 try{
  await db.prepare(`INSERT INTO academic_plan_events
   (operation_id,learner_id,actor_auth_subject,expected_revision,level,next_wird,revision_wird,focus,at_ms)
   VALUES(?,?,?,?,?,?,?,?,?)`)
  .bind(command.operationId,learnerId,subject,command.expectedRevision,command.level,
    command.nextWird,command.revisionWird,command.focus,now).run();
 }catch(error){
  const other=await find();
  if(other)return replay(other);
  if(error instanceof Error&&error.message.includes('PLAN_REVISION_CONFLICT'))
    return {status:409,code:'PLAN_REVISION_CONFLICT'} as const;
  if(error instanceof Error&&error.message.includes('PLAN_ACCESS_DENIED'))
    return {status:404,code:'NOT_FOUND'} as const;
  throw error;
 }
 return {status:200,code:'PLAN_SAVED',revision:command.expectedRevision+1} as const;
}
