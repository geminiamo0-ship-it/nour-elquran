import type { CoreDatabase } from './bindings.ts';

export type LearnerProfileAction =
  | Readonly<{action:'rename';operationId:string;expectedRevision:number;name:string}>
  | Readonly<{action:'archive';operationId:string;expectedRevision:number}>;

export type ProfileOutcome = Readonly<{
  status:number;code:string;revision?:number;
}>;

const UUID_V4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseLearnerProfileAction(input:unknown):LearnerProfileAction|null {
  if(!input || typeof input!=='object' || Array.isArray(input))return null;
  const data=input as Record<string,unknown>;
  if(!UUID_V4.test(String(data.operationId)) ||
      !Number.isSafeInteger(data.expectedRevision) || Number(data.expectedRevision)<1)return null;
  if(data.action==='archive' && Object.keys(data).length===3 &&
      ['action','operationId','expectedRevision'].every(k=>k in data))
    return {action:'archive',operationId:data.operationId as string,expectedRevision:data.expectedRevision as number};
  if(data.action==='rename' && Object.keys(data).length===4 &&
      ['action','operationId','expectedRevision','name'].every(k=>k in data) &&
      typeof data.name==='string' && data.name.trim().length>0 && data.name.trim().length<=50)
    return {action:'rename',operationId:data.operationId as string,expectedRevision:data.expectedRevision as number,
      name:data.name.trim()};
  return null;
}
type EventRow={learner_id:string;account_id:string;actor_auth_subject:string;
  action:string;expected_revision:number;new_name:string|null};

export async function applyLearnerProfileAction(db:CoreDatabase, accountId:string,
  subject:string, learnerId:string, command:LearnerProfileAction):Promise<ProfileOutcome> {
  const findEvent=()=>db.prepare(`SELECT learner_id,account_id,actor_auth_subject,action,expected_revision,new_name
      FROM learner_profile_events WHERE operation_id=? LIMIT 1`).bind(command.operationId).first<EventRow>();
  const replayResult=(event:EventRow|null):ProfileOutcome|null=>{
    if(!event)return null;
    return event.learner_id===learnerId && event.account_id===accountId &&
      event.actor_auth_subject===subject && event.action===command.action &&
      event.expected_revision===command.expectedRevision &&
      event.new_name===(command.action==='rename'?command.name:null)
      ? {status:200,code:'OPERATION_ALREADY_APPLIED',revision:command.expectedRevision+1}
      : {status:409,code:'OPERATION_CONFLICT'};
  };
  const replay=await findEvent();
  if(replay){
    // A caller cannot inspect another owner's operation via a guessed operationId.
    if(replay.account_id!==accountId || replay.actor_auth_subject!==subject ||
        replay.learner_id!==learnerId)return {status:404,code:'NOT_FOUND'};
    return replayResult(replay)!;
  }
  const owned=await db.prepare(`SELECT l.id FROM learners l
    JOIN accounts a ON a.id=l.account_id
    WHERE l.id=? AND l.account_id=? AND a.auth_subject=? AND a.status='active'
      AND l.status='active' LIMIT 1`).bind(learnerId,accountId,subject).first<{id:string}>();
  if(!owned)return {status:404,code:'NOT_FOUND'};
  try {
    await db.prepare(`INSERT INTO learner_profile_events
      (operation_id,learner_id,account_id,actor_auth_subject,action,expected_revision,new_name,at_ms)
      VALUES(?,?,?,?,?,?,?,?)`).bind(command.operationId,learnerId,accountId,subject,
      command.action,command.expectedRevision,command.action==='rename'?command.name:null,Date.now()).run();
  }catch(error){
    // Concurrent duplicate requests may race the pre-check; compare their immutable event.
    const concurrent=await findEvent();
    if(concurrent)return replayResult(concurrent)!;
    if(error instanceof Error && error.message.includes('PROFILE_HAS_OPEN_LESSONS'))
      return {status:409,code:'PROFILE_OPEN_LESSONS'};
    if(error instanceof Error && /PROFILE_(STALE_OR_FORBIDDEN|NO_CHANGE)/.test(error.message))
      return {status:409,code:'PROFILE_REVISION_CONFLICT'};
    throw error;
  }
  return {status:200,code:'PROFILE_UPDATED',revision:command.expectedRevision+1};
}
