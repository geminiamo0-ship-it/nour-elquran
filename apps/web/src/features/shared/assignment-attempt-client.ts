import {AssignmentError} from './published-assignment-client';
export type AssignmentAttempt=Readonly<{
 id:string;attempt:number;note:string;submittedAtMs:number;
 decision:'accepted'|'retry_requested'|null;feedback:string|null;reviewedAtMs:number|null;
}>;
const safe=(v:string)=>{if(!/^[a-zA-Z0-9-]{1,128}$/.test(v))throw new AssignmentError('INVALID_ID');return v;};
export function parseAttempts(raw:unknown):readonly AssignmentAttempt[]{
 if(!Array.isArray(raw)||raw.length>5)throw new AssignmentError('INVALID_RESPONSE');
 const items=raw.map(x=>{
  if(!x||typeof x!=='object'||Array.isArray(x))throw new AssignmentError('INVALID_RESPONSE');
  const v=x as Record<string,unknown>;
  if(typeof v.id!=='string'||!/^[a-f0-9-]{36}$/i.test(v.id)||
   !Number.isInteger(v.attempt)||Number(v.attempt)<1||Number(v.attempt)>5||
   typeof v.note!=='string'||v.note.length>500||
   !Number.isSafeInteger(v.submittedAtMs)||
   (v.decision!==null&&v.decision!=='accepted'&&v.decision!=='retry_requested')||
   (v.feedback!==null&&(typeof v.feedback!=='string'||v.feedback.length>1000))||
   (v.reviewedAtMs!==null&&!Number.isSafeInteger(v.reviewedAtMs)))
   throw new AssignmentError('INVALID_RESPONSE');
  return v as AssignmentAttempt;
 });
 if(new Set(items.map(x=>x.id)).size!==items.length)throw new AssignmentError('INVALID_RESPONSE');
 return items;
}
export function assignmentAttemptClient(transport:typeof fetch=fetch){
 async function send(url:string,body?:unknown,signal?:AbortSignal){
  let response:Response;
  try{response=await transport(url,{method:body===undefined?'GET':'POST',credentials:'same-origin',
   cache:'no-store',redirect:'error',...(signal?{signal}:{}),
   ...(body===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)})});}
  catch{throw new AssignmentError('NETWORK_ERROR');}
  let raw:unknown;
  try{raw=await response.json();}catch{throw new AssignmentError('INVALID_RESPONSE',response.status);}
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new AssignmentError('INVALID_RESPONSE');
  const data=raw as Record<string,unknown>;
  if(!response.ok)throw new AssignmentError(typeof data.code==='string'?data.code:'REQUEST_FAILED',response.status);
  return data;
 }
 const owner=(learner:string,task:string)=>
  '/v1/me/learners/'+safe(learner)+'/assignments/'+safe(task)+'/submissions';
 const teacher=(learner:string,task:string)=>
  '/v1/teacher/learners/'+safe(learner)+'/assignments/'+safe(task)+'/reviews';
 function ack(data:Record<string,unknown>,code:string,replay:string,key:string){
  if((data.code!==code&&data.code!==replay)||typeof data[key]!=='string'||
     !/^[a-f\d-]{36}$/i.test(String(data[key])))throw new AssignmentError('INVALID_RESPONSE');
  return String(data[key]);
 }
 return {
  studentAttempts:async(learner:string,task:string,signal?:AbortSignal)=>
   parseAttempts((await send(owner(learner,task),undefined,signal)).attempts),
  teacherAttempts:async(learner:string,task:string,signal?:AbortSignal)=>
   parseAttempts((await send(teacher(learner,task),undefined,signal)).attempts),
  submit:async(learner:string,task:string,note:string,operationId:string)=>
   ack(await send(owner(learner,task),{operationId,note}),'SUBMISSION_SENT','SUBMISSION_ALREADY_SENT','submissionId'),
  review:async(learner:string,task:string,submissionId:string,
    decision:'accepted'|'retry_requested',feedback:string,operationId:string)=>
   ack(await send(teacher(learner,task),{operationId,submissionId,decision,feedback}),
      'REVIEW_SAVED','REVIEW_ALREADY_SAVED','reviewId'),
 };
}
