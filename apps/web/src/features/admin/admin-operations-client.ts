/** #309: Client commands only. Authorization and all business validation live on
 * existing signed Better Auth + D1 trigger-backed staff endpoints.
 */
export type AdminOperationKind='teacher'|'schedule'|'attendance';
export type AdminActionResult=Readonly<{code:string;resourceId?:string}>;
export class AdminActionError extends Error{
 constructor(readonly code:string,readonly status=0,readonly uncertain=false){super(code);}
}
const paths:Record<AdminOperationKind,string>={
 teacher:'/v1/staff/teacher-actions',
 schedule:'/v1/staff/schedule-actions',
 attendance:'/v1/staff/attendance-appeals/review',
};
const success:Record<AdminOperationKind,readonly string[]>={
 teacher:['TEACHER_ROLE_CHANGED','OPERATION_ALREADY_APPLIED'],
 schedule:['SCHEDULE_ACTION_APPLIED','OPERATION_ALREADY_APPLIED'],
 attendance:['ATTENDANCE_REVIEW_RECORDED','ATTENDANCE_REVIEW_REPLAY'],
};
const asRecord=(v:unknown):v is Record<string,unknown>=>
 v!==null&&typeof v==='object'&&!Array.isArray(v);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID=/^[A-Za-z0-9_-]{1,128}$/;
export function validAdminAction(kind:AdminOperationKind,value:unknown):boolean{
 if(!asRecord(value)||typeof value.operationId!=='string'||
  !UUID.test(value.operationId)||typeof value.reason!=='string'||
  value.reason.trim()!==value.reason)return false;
 const r=value.reason.length;
 if(r<(kind==='attendance'?10:8)||r>500)return false;
 const exact=(keys:readonly string[])=>
  Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
 const identifier=(key:string)=>typeof value[key]==='string'&&ID.test(value[key] as string);
 if(kind==='teacher'){
  if(value.action==='provision')
   return exact(['operationId','reason','action','targetUserId'])&&identifier('targetUserId');
  return exact(['operationId','reason','action','teacherId'])&&identifier('teacherId')&&
   ['qualify','activate','suspend','revoke_qualification'].includes(String(value.action));
 }
 if(kind==='attendance'){
  return exact(['operationId','reason','decision','appealId'])&&identifier('appealId')&&
   ['accepted','rejected'].includes(String(value.decision));
 }
 if(!['assign','revoke','book','cancel'].includes(String(value.action)))return false;
 if(value.action==='revoke'||value.action==='cancel')
  return exact(['operationId','reason','action','resourceId'])&&identifier('resourceId');
 if(!identifier('learnerId')||!identifier('teacherId')||
  typeof value.startsAtMs!=='number'||!Number.isSafeInteger(value.startsAtMs)||
  value.startsAtMs<Date.now())return false;
 if(value.action==='assign')
  return exact(['operationId','reason','action','learnerId','teacherId',
   'startsAtMs','endsAtMs'])&&typeof value.endsAtMs==='number'&&
   Number.isSafeInteger(value.endsAtMs)&&value.endsAtMs>value.startsAtMs;
 return exact(['operationId','reason','action','learnerId','teacherId','startsAtMs','kind'])&&
  ['trial','standard','makeup'].includes(String(value.kind));
}
export async function submitAdminAction(kind:AdminOperationKind,command:unknown,
 signal?:AbortSignal):Promise<AdminActionResult>{
 if(!validAdminAction(kind,command))throw new AdminActionError('INVALID_ACTION_INPUT',400);
 let response:Response;
 try{
  const endpoint=kind==='teacher'&&asRecord(command)&&typeof command.teacherId==='string'
   ?'/v1/staff/teachers/transition':paths[kind];
  response=await fetch(endpoint,{method:'POST',credentials:'same-origin',
   cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json'},
   body:JSON.stringify(command),...(signal?{signal}:{})});
 }catch{
  // The request may already have reached D1. Do not claim failure or retry
  // automatically. A caller may explicitly replay the SAME operationId/body.
  throw new AdminActionError('NETWORK_OUTCOME_UNKNOWN',0,true);
 }
 let body:unknown;
 try{body=await response.json();}catch{
  throw new AdminActionError('INVALID_SERVER_RESPONSE',response.status,!response.ok?false:true);
 }
 if(!asRecord(body)||typeof body.code!=='string')
  throw new AdminActionError('INVALID_SERVER_RESPONSE',response.status,response.ok);
 if(!response.ok)throw new AdminActionError(body.code,response.status);
 if(!success[kind].includes(body.code))
  throw new AdminActionError('UNKNOWN_SERVER_SUCCESS',response.status,true);
 const id=kind==='teacher'?body.teacherId:
  kind==='schedule'?body.resourceId:body.decisionId;
 if(id!==undefined&&(typeof id!=='string'||!ID.test(id)))
  throw new AdminActionError('INVALID_SERVER_RESPONSE',response.status,true);
 return {code:body.code,...(typeof id==='string'?{resourceId:id}:{})};
}
