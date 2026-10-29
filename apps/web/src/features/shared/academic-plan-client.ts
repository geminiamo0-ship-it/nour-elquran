/** Shared read/write contract for teacher-authored student academic plans.
 * Never interpret a network failure as an empty plan or a confirmed save.
 */
export type AcademicPlan = Readonly<{
 level:'beginner'|'intermediate'|'advanced';nextWird:string;
 revisionWird:string;focus:string;revision:number;updatedAtMs:number;
}>;
export type AcademicPlanInput = Pick<AcademicPlan,'level'|'nextWird'|'revisionWird'|'focus'>;
export class PlanClientError extends Error {
 constructor(readonly code:string,readonly status=0){super(code);}
}
function validateId(value:string){
 if(!/^[a-zA-Z0-9-]{1,128}$/.test(value))throw new PlanClientError('INVALID_LEARNER_ID');
 return value;
}
function record(raw:unknown):Record<string,unknown>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new PlanClientError('INVALID_RESPONSE');
 return raw as Record<string,unknown>;
}
export function parseAcademicPlan(raw:unknown):AcademicPlan|null{
 if(raw===null)return null;
 const row=record(raw);
 if(!['beginner','intermediate','advanced'].includes(String(row.level))||
   ![row.nextWird,row.revisionWird,row.focus].every(v=>typeof v==='string'&&v.trim().length>0)||
   typeof row.nextWird!=='string'||row.nextWird.length>300||
   typeof row.revisionWird!=='string'||row.revisionWird.length>500||
   typeof row.focus!=='string'||row.focus.length>500||
   !Number.isSafeInteger(row.revision)||Number(row.revision)<1||
   !Number.isSafeInteger(row.updatedAtMs)||Number(row.updatedAtMs)<0)
   throw new PlanClientError('INVALID_RESPONSE');
 return {level:row.level as AcademicPlan['level'],nextWird:row.nextWird as string,
  revisionWird:row.revisionWird as string,focus:row.focus as string,
  revision:row.revision as number,updatedAtMs:row.updatedAtMs as number};
}
export function planMessage(error:unknown){
 if(!(error instanceof PlanClientError))return 'تعذر الحفظ. تحقق من الاتصال ثم حدّث الخطة قبل التكرار.';
 if(error.status===401)return 'انتهت الجلسة. سجّل الدخول من جديد.';
 if(error.status===403||error.status===404)return 'لم تعد صلاحية الوصول لهذا الطالب متاحة.';
 if(error.status===409)return 'تغيّرت الخطة على جهاز آخر. أعد تحميل النسخة الأخيرة قبل التعديل.';
 if(error.code==='PLAN_SCHEMA_NOT_READY')return 'الخطة الأكاديمية قيد التجهيز على الخادم.';
 return 'تعذر تحميل أو حفظ الخطة. أعد المحاولة.';
}
export function academicPlanClient(transport:typeof fetch=fetch){
 async function call(path:string,body?:unknown,signal?:AbortSignal){
  let response:Response;
  try{response=await transport(path,{
   method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
   ...(signal?{signal}:{}),
   ...(body===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)}),
  });}catch{throw new PlanClientError('NETWORK_ERROR');}
  let value:Record<string,unknown>;
  try{value=record(await response.json());}catch{throw new PlanClientError('INVALID_RESPONSE',response.status);}
  if(!response.ok)throw new PlanClientError(typeof value.code==='string'?value.code:'SERVICE_UNAVAILABLE',response.status);
  return value;
 }
 return {
  teacherPlan:async(id:string,signal?:AbortSignal)=>parseAcademicPlan(
    (await call('/v1/teacher/learners/'+validateId(id)+'/plan',undefined,signal)).plan),
  ownerPlan:async(id:string,signal?:AbortSignal)=>parseAcademicPlan(
    (await call('/v1/me/learners/'+validateId(id)+'/plan',undefined,signal)).plan),
  save:async(id:string,input:AcademicPlanInput,expectedRevision:number,operationId:string)=>{
   const data=await call('/v1/teacher/learners/'+validateId(id)+'/plan-actions',
    {...input,expectedRevision,operationId});
   if(!['PLAN_SAVED','PLAN_ALREADY_SAVED'].includes(String(data.code))||
     data.revision!==expectedRevision+1)throw new PlanClientError('INVALID_RESPONSE');
   return data.revision as number;
  },
 };
}
