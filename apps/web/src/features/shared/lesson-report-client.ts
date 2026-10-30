/** Single strict transport boundary for Cloudflare lesson reports. No role/owner header. */
export type ReportContent={
 scope:string;strengths:string;corrections:string;nextPlan:string;
 memorization:number|null;recitation:number|null;tajweed:number|null;
};
export type TeacherReport=ReportContent&{
 lessonId:string;revision:number;status:'draft'|'published';
 publishedRevision:number|null;updatedAtMs:number;
};
export type StudentReport=ReportContent&{
 lessonId:string;learnerId:string;revision:number;publishedAtMs:number;
};
export class ReportApiError extends Error {
 constructor(readonly code:string,readonly status=0){super(code);}
}
const obj=(v:unknown):Record<string,unknown>=>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw new ReportApiError('INVALID_RESPONSE');
 return v as Record<string,unknown>;
};
const id=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,128}$/.test(v);
const grade=(v:unknown)=>v===null||(typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=10);
function content(v:Record<string,unknown>):ReportContent {
 if(typeof v.scope!=='string'||v.scope.length>700||
  typeof v.strengths!=='string'||v.strengths.length>1000||
  typeof v.corrections!=='string'||v.corrections.length>1000||
  typeof v.nextPlan!=='string'||v.nextPlan.length>1000||
  !grade(v.memorization)||!grade(v.recitation)||!grade(v.tajweed))
  throw new ReportApiError('INVALID_RESPONSE');
 return {scope:v.scope,strengths:v.strengths,corrections:v.corrections,
  nextPlan:v.nextPlan,memorization:v.memorization as number|null,
  recitation:v.recitation as number|null,tajweed:v.tajweed as number|null};
}
export const blankReport=():ReportContent=>({
 scope:'',strengths:'',corrections:'',nextPlan:'',
 memorization:null,recitation:null,tajweed:null,
});
export function parseTeacherReport(raw:unknown):TeacherReport|null {
 const v=obj(raw).report;
 if(v===null)return null;
 const data=obj(v);
 if(!id(data.lessonId)||!Number.isSafeInteger(data.revision)||Number(data.revision)<1||
  !['draft','published'].includes(String(data.status))||
  !(data.publishedRevision===null||(Number.isSafeInteger(data.publishedRevision)&&
   Number(data.publishedRevision)>=1&&Number(data.publishedRevision)<=Number(data.revision)))||
  !Number.isSafeInteger(data.updatedAtMs)||Number(data.updatedAtMs)<0)
  throw new ReportApiError('INVALID_RESPONSE');
 return {...content(data),lessonId:data.lessonId as string,revision:data.revision as number,
  status:data.status as TeacherReport['status'],
  publishedRevision:data.publishedRevision as number|null,updatedAtMs:data.updatedAtMs as number};
}
export function parseStudentReports(raw:unknown):StudentReport[] {
 const rows=obj(raw).reports;
 if(!Array.isArray(rows)||rows.length>100)throw new ReportApiError('INVALID_RESPONSE');
 return rows.map(value=>{
  const v=obj(value);
  if(!id(v.lessonId)||!id(v.learnerId)||!Number.isSafeInteger(v.revision)||
   Number(v.revision)<1||!Number.isSafeInteger(v.publishedAtMs)||Number(v.publishedAtMs)<0)
   throw new ReportApiError('INVALID_RESPONSE');
  return {...content(v),lessonId:v.lessonId as string,learnerId:v.learnerId as string,
   revision:v.revision as number,publishedAtMs:v.publishedAtMs as number};
 });
}
async function call(path:string,body?:unknown,signal?:AbortSignal):Promise<unknown> {
 let response:Response;
 try{response=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',
  cache:'no-store',redirect:'error',...(body?{headers:{'content-type':'application/json'},
   body:JSON.stringify(body)}:{}),...(signal?{signal}:{})});}
 catch(e){if(signal?.aborted)throw e;throw new ReportApiError('NETWORK_UNCERTAIN');}
 let value:unknown;try{value=await response.json();}catch{throw new ReportApiError('INVALID_RESPONSE',response.status);}
 if(!response.ok){
  const code=obj(value).code;
  throw new ReportApiError(typeof code==='string'?code:'REQUEST_FAILED',response.status);
 }
 return value;
}
const encode=(value:string)=>encodeURIComponent(value);
export const lessonReportsClient={
 teacher:async(lessonId:string,signal?:AbortSignal)=>parseTeacherReport(await call(
  '/v1/teacher/lessons/'+encode(lessonId)+'/report',undefined,signal)),
 student:async(learnerId:string,signal?:AbortSignal)=>parseStudentReports(await call(
  '/v1/me/learners/'+encode(learnerId)+'/reports',undefined,signal)),
 save:async(lessonId:string,expectedRevision:number,data:ReportContent,operationId:string)=>call(
  '/v1/teacher/lessons/'+encode(lessonId)+'/report-actions',
  {kind:'save',operationId,expectedRevision,...data}),
 publish:async(lessonId:string,expectedRevision:number,operationId:string)=>call(
  '/v1/teacher/lessons/'+encode(lessonId)+'/report-actions',
  {kind:'publish',operationId,expectedRevision}),
};
export const reportErrorMessage=(err:unknown)=>{
 const code=err instanceof ReportApiError?err.code:'UNKNOWN';
 if(code==='REPORT_REVISION_CONFLICT')return 'تم تحديث التقرير في جلسة أخرى. حدّثه قبل المحاولة.';
 if(code==='REPORT_NOT_READY_TO_PUBLISH')return 'احفظ مسودة مكتملة قبل النشر.';
 if(code==='NOT_FOUND'||code==='UNAUTHENTICATED')return 'انتهت الصلاحية أو لم تُعتمد نهاية الحصة بعد.';
 return 'تعذر تأكيد العملية. حدّث التقرير قبل إعادة الإرسال حتى لا يتكرر.';
};
