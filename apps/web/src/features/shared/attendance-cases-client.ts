/** #246: signed role-bound attendance API. No client-controlled actor, lesson
 * attendance verdict, debit, media file or guardian status is ever sent. */
export type AttendanceCase=Readonly<{
 incidentId:string;lessonId:string;kind:'student_no_show'|'connection_interruption';
 reason:string;reportedAtMs:number;appealId:string|null;appealedAtMs:number|null;
 decision:'accepted'|'rejected'|null;decisionReason:string|null;decidedAtMs:number|null;
}>;
export type TeacherAttendanceCase=Readonly<Pick<AttendanceCase,
 'incidentId'|'lessonId'|'kind'|'reason'|'reportedAtMs'>&{learnerId:string}>;
export class AttendanceApiError extends Error{
 constructor(readonly code:string,readonly status=0){super(code);}
}
const id=/^[A-Za-z0-9-]{1,128}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const numeric=(v:unknown):v is number=>Number.isSafeInteger(v)&&typeof v==='number'&&v>=0;
const nullOr=(v:unknown,predicate:(x:unknown)=>boolean)=>v===null||predicate(v);
const isString=(v:unknown):v is string=>typeof v==='string';
const isUuid=(v:unknown)=>isString(v)&&uuid.test(v);
function checkId(raw:string){
 if(!id.test(raw))throw new AttendanceApiError('INVALID_LEARNER');
 return encodeURIComponent(raw);
}
export function parseAttendanceCases(raw:unknown,role:'owner'|'teacher'){
 if(!object(raw)||raw.code!=='ATTENDANCE_CASES'||!Array.isArray(raw.incidents)||
 raw.incidents.length>50)throw new AttendanceApiError('INVALID_ATTENDANCE_RESPONSE');
 if(role==='owner')return raw.incidents.map((v:unknown):AttendanceCase=>{
  if(!object(v)||!isUuid(v.incidentId)||!id.test(String(v.lessonId))||
   !['student_no_show','connection_interruption'].includes(String(v.kind))||
   !isString(v.reason)||v.reason.length>500||!numeric(v.reportedAtMs)||
   !nullOr(v.appealId,isUuid)||!nullOr(v.appealedAtMs,numeric)||
   !nullOr(v.decision,x=>x==='accepted'||x==='rejected')||
   !nullOr(v.decisionReason,x=>isString(x)&&x.length<=500)||
   !nullOr(v.decidedAtMs,numeric))
   throw new AttendanceApiError('INVALID_ATTENDANCE_RESPONSE');
  return v as AttendanceCase;
 });
 return raw.incidents.map((v:unknown):TeacherAttendanceCase=>{
  if(!object(v)||!isUuid(v.incidentId)||!id.test(String(v.lessonId))||
    !id.test(String(v.learnerId))||
    !['student_no_show','connection_interruption'].includes(String(v.kind))||
    !isString(v.reason)||v.reason.length>500||!numeric(v.reportedAtMs))
    throw new AttendanceApiError('INVALID_ATTENDANCE_RESPONSE');
  return v as TeacherAttendanceCase;
 });
}
async function api(path:string,body?:unknown,signal?:AbortSignal):Promise<Record<string,unknown>>{
 let response:Response;
 try{response=await fetch(path,{credentials:'same-origin',cache:'no-store',redirect:'error',
  method:body===undefined?'GET':'POST',...(body===undefined?{}:{
   headers:{'content-type':'application/json'},body:JSON.stringify(body)}),
  ...(signal?{signal}:{})});}
 catch{throw new AttendanceApiError('NETWORK_UNAVAILABLE');}
 let value:unknown;
 try{value=await response.json();}catch{throw new AttendanceApiError('INVALID_ATTENDANCE_RESPONSE',response.status);}
 if(!object(value))throw new AttendanceApiError('INVALID_ATTENDANCE_RESPONSE',response.status);
 if(!response.ok)throw new AttendanceApiError(isString(value.code)?value.code:'ATTENDANCE_UNAVAILABLE',
  response.status);
 return value;
}
export const attendanceClient={
 teacherCases:async(signal?:AbortSignal)=>
  parseAttendanceCases(await api('/v1/teacher/attendance-cases',undefined,signal),'teacher') as TeacherAttendanceCase[],
 ownerCases:async(learnerId:string,signal?:AbortSignal)=>
  parseAttendanceCases(await api('/v1/me/learners/'+checkId(learnerId)+'/attendance-cases',undefined,signal),'owner') as AttendanceCase[],
 report:async(lessonId:string,kind:'student_no_show'|'connection_interruption',
  reason:string,operationId:string)=>{
   if(!id.test(lessonId)||!uuid.test(operationId)||reason.trim().length<10||reason.length>500)
    throw new AttendanceApiError('INVALID_ATTENDANCE_REPORT');
   const value=await api('/v1/teacher/lessons/'+encodeURIComponent(lessonId)+'/attendance-report',
    {operationId,kind,reason:reason.trim()});
   if(!['ATTENDANCE_REPORT_RECORDED','ATTENDANCE_REPORT_REPLAY'].includes(String(value.code))||
      !isUuid(value.incidentId))throw new AttendanceApiError('INVALID_ATTENDANCE_RESPONSE');
   return value.incidentId as string;
  },
 appeal:async(learnerId:string,incidentId:string,reason:string,operationId:string)=>{
   if(!uuid.test(incidentId)||!uuid.test(operationId)||reason.trim().length<10||reason.length>1000)
    throw new AttendanceApiError('INVALID_ATTENDANCE_APPEAL');
   const value=await api('/v1/me/learners/'+checkId(learnerId)+'/attendance-appeals',
    {incidentId,operationId,reason:reason.trim()});
   if(!['ATTENDANCE_APPEAL_SUBMITTED','ATTENDANCE_APPEAL_REPLAY'].includes(String(value.code))||
      !isUuid(value.appealId))throw new AttendanceApiError('INVALID_ATTENDANCE_RESPONSE');
   return value.appealId as string;
  }
};
