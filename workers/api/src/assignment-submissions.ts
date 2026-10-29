import type {CoreDatabase} from './bindings.ts';
import {verifiedCurrentTeacher,verifiedOwner} from './published-assignments.ts';

type Submit={operationId:string;note:string};
type Review={operationId:string;submissionId:string;decision:'accepted'|'retry_requested';feedback:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const keys=(v:Record<string,unknown>,k:string[])=>Object.keys(v).length===k.length&&k.every(x=>x in v);
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function parseSubmission(raw:unknown):Submit|null{
 if(!obj(raw)||!keys(raw,['operationId','note'])||typeof raw.operationId!=='string'||
   !uuid.test(raw.operationId)||typeof raw.note!=='string'||raw.note.trim().length>500)return null;
 return {operationId:raw.operationId,note:raw.note.trim()};
}
export function parseReview(raw:unknown):Review|null{
 if(!obj(raw)||!keys(raw,['operationId','submissionId','decision','feedback'])||
   typeof raw.operationId!=='string'||!uuid.test(raw.operationId)||
   typeof raw.submissionId!=='string'||!uuid.test(raw.submissionId)||
   !['accepted','retry_requested'].includes(String(raw.decision))||
   typeof raw.feedback!=='string'||raw.feedback.trim().length<1||raw.feedback.trim().length>1000)
  return null;
 return {operationId:raw.operationId,submissionId:raw.submissionId,
  decision:raw.decision as Review['decision'],feedback:raw.feedback.trim()};
}
type AttemptRow={id:string;attempt:number;note:string;submitted_at_ms:number;
 decision:'accepted'|'retry_requested'|null;feedback:string|null;reviewed_at_ms:number|null};
function formatted(v:AttemptRow){
 return {id:v.id,attempt:v.attempt,note:v.note,submittedAtMs:v.submitted_at_ms,
  decision:v.decision,feedback:v.feedback,reviewedAtMs:v.reviewed_at_ms};
}
async function assignmentExists(db:CoreDatabase,learnerId:string,assignmentId:string){
 const row=await db.prepare('SELECT 1 AS found FROM learner_assignments WHERE learner_id=? AND id=?')
 .bind(learnerId,assignmentId).first<{found:number}>();
 return row?.found===1;
}
async function readAttempts(db:CoreDatabase,assignmentId:string){
 const rows=await db.prepare(`SELECT s.id,s.attempt,s.note,s.submitted_at_ms,
   r.decision,r.feedback,r.reviewed_at_ms
   FROM assignment_submission_events s
   LEFT JOIN assignment_review_events r ON r.submission_id=s.id
   WHERE s.assignment_id=? ORDER BY s.attempt DESC LIMIT 5`)
 .bind(assignmentId).all<AttemptRow>();
 return rows.results.map(formatted);
}
export async function getStudentAttempts(db:CoreDatabase,actor:string,learnerId:string,assignmentId:string){
 if(!await verifiedOwner(db,actor,learnerId)||
    !await assignmentExists(db,learnerId,assignmentId))return {status:404,code:'NOT_FOUND'} as const;
 return {status:200,attempts:await readAttempts(db,assignmentId)} as const;
}
export async function getTeacherAttempts(db:CoreDatabase,actor:string,learnerId:string,assignmentId:string,now=Date.now()){
 if(!await verifiedCurrentTeacher(db,actor,learnerId,now)||
   !await assignmentExists(db,learnerId,assignmentId))return {status:404,code:'NOT_FOUND'} as const;
 return {status:200,attempts:await readAttempts(db,assignmentId)} as const;
}
export async function submitStudentAttempt(db:CoreDatabase,actor:string,learnerId:string,
 assignmentId:string,input:Submit,now=Date.now()){
 if(!await verifiedOwner(db,actor,learnerId)||
    !await assignmentExists(db,learnerId,assignmentId))return {status:404,code:'NOT_FOUND'} as const;
 const prior=()=>db.prepare(`SELECT id,assignment_id,learner_id,actor_auth_subject,note,attempt
  FROM assignment_submission_events WHERE operation_id=?`).bind(input.operationId)
  .first<{id:string;assignment_id:string;learner_id:string;actor_auth_subject:string;note:string;attempt:number}>();
 const old=await prior();
 const replay=(row:NonNullable<Awaited<ReturnType<typeof prior>>>)=>{
  if(row.assignment_id!==assignmentId||row.learner_id!==learnerId||row.actor_auth_subject!==actor)
   return {status:404,code:'NOT_FOUND'} as const;
  if(row.note!==input.note)return {status:409,code:'SUBMISSION_OPERATION_CONFLICT'} as const;
  return {status:200,code:'SUBMISSION_ALREADY_SENT',submissionId:row.id,attempt:row.attempt} as const;
 };
 if(old)return replay(old);
 const history=await readAttempts(db,assignmentId),last=history[0];
 if(last&&(last.decision!=='retry_requested'||last.attempt>=5))
  return {status:409,code:'SUBMISSION_NOT_RETRYABLE'} as const;
 const attempt=(last?.attempt??0)+1,id=crypto.randomUUID();
 try{
  await db.prepare(`INSERT INTO assignment_submission_events(operation_id,id,assignment_id,
   learner_id,actor_auth_subject,attempt,note,submitted_at_ms)
   VALUES(?,?,?,?,?,?,?,?)`).bind(input.operationId,id,assignmentId,learnerId,actor,
     attempt,input.note,now).run();
 }catch(e){
  const found=await prior();
  if(found)return replay(found);
  if(e instanceof Error){
   if(e.message.includes('SUBMISSION_OWNER_DENIED'))return {status:404,code:'NOT_FOUND'} as const;
   if(e.message.includes('SUBMISSION_NOT_RETRYABLE')||e.message.includes('SUBMISSION_INVALID_ATTEMPT')||
     e.message.includes('UNIQUE constraint'))return {status:409,code:'SUBMISSION_NOT_RETRYABLE'} as const;
  }
  throw e;
 }
 return {status:201,code:'SUBMISSION_SENT',submissionId:id,attempt} as const;
}
export async function reviewStudentAttempt(db:CoreDatabase,actor:string,learnerId:string,
 assignmentId:string,input:Review,now=Date.now()){
 if(!await verifiedCurrentTeacher(db,actor,learnerId,now)||
    !await assignmentExists(db,learnerId,assignmentId))return {status:404,code:'NOT_FOUND'} as const;
 const prior=()=>db.prepare(`SELECT id,submission_id,assignment_id,learner_id,
 actor_auth_subject,decision,feedback FROM assignment_review_events WHERE operation_id=?`)
  .bind(input.operationId)
  .first<{id:string;submission_id:string;assignment_id:string;learner_id:string;
    actor_auth_subject:string;decision:string;feedback:string}>();
 const old=await prior();
 const replay=(row:NonNullable<Awaited<ReturnType<typeof prior>>>)=>{
  if(row.assignment_id!==assignmentId||row.learner_id!==learnerId||row.actor_auth_subject!==actor)
   return {status:404,code:'NOT_FOUND'} as const;
  if(row.submission_id!==input.submissionId||row.decision!==input.decision||row.feedback!==input.feedback)
   return {status:409,code:'REVIEW_OPERATION_CONFLICT'} as const;
  return {status:200,code:'REVIEW_ALREADY_SAVED',reviewId:row.id} as const;
 };
 if(old)return replay(old);
 const attempts=await readAttempts(db,assignmentId),last=attempts[0];
 if(!last||last.id!==input.submissionId)return {status:404,code:'SUBMISSION_NOT_FOUND'} as const;
 if(last.decision!==null)return {status:409,code:'REVIEW_ALREADY_EXISTS'} as const;
 const id=crypto.randomUUID();
 try{
  await db.prepare(`INSERT INTO assignment_review_events(operation_id,id,submission_id,
   assignment_id,learner_id,actor_auth_subject,decision,feedback,reviewed_at_ms)
   VALUES(?,?,?,?,?,?,?,?,?)`).bind(input.operationId,id,input.submissionId,assignmentId,
   learnerId,actor,input.decision,input.feedback,now).run();
 }catch(e){
  const found=await prior();
  if(found)return replay(found);
  if(e instanceof Error){
   if(e.message.includes('REVIEW_TEACHER_DENIED'))return {status:404,code:'NOT_FOUND'} as const;
   if(e.message.includes('UNIQUE constraint')||e.message.includes('REVIEW_NOT_LATEST_ATTEMPT'))
    return {status:409,code:'REVIEW_ALREADY_EXISTS'} as const;
   if(e.message.includes('REVIEW_TARGET_DENIED'))
    return {status:404,code:'SUBMISSION_NOT_FOUND'} as const;
  }
  throw e;
 }
 return {status:201,code:'REVIEW_SAVED',reviewId:id} as const;
}
