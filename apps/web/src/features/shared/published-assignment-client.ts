/** Strict same-origin teacher/owner published-task DTO; never turn failure into empty fixtures. */
export type PublishedAssignment=Readonly<{
 id:string;learnerId:string;kind:'memorization'|'revision'|'recitation';
 editionId:string;surah:number;fromAyah:number;toAyah:number;startPage:number;endPage:number;
 dueAtMs:number;instructions:string;publishedAtMs:number;status:'assigned';revision:1;
}>;
export type AssignmentDraft=Readonly<{
 kind:PublishedAssignment['kind'];editionId:string;surah:number;
 fromAyah:number;toAyah:number;dueAtMs:number;instructions:string;
}>;
export type AssignmentSource=Readonly<{editionId:string;surah:number;ayahCount:number}>;
export class AssignmentError extends Error{
 constructor(readonly code:string,readonly status=0){super(code);}
}
const checkId=(value:string)=>{
 if(!/^[a-zA-Z0-9-]{1,128}$/.test(value))throw new AssignmentError('INVALID_LEARNER_ID');
 return value;
};
const object=(value:unknown)=>{
 if(!value||typeof value!=='object'||Array.isArray(value))
   throw new AssignmentError('INVALID_RESPONSE');
 return value as Record<string,unknown>;
};
export function parsePublishedTasks(raw:unknown):readonly PublishedAssignment[]{
 if(!Array.isArray(raw)||raw.length>100)throw new AssignmentError('INVALID_RESPONSE');
 return raw.map(value=>{
  const v=object(value),integer=(x:unknown,min:number,max:number)=>
   Number.isSafeInteger(x)&&Number(x)>=min&&Number(x)<=max;
  if(typeof v.id!=='string'||!/^[-a-f\d]{36}$/i.test(v.id)||
    typeof v.learnerId!=='string'||!checkId(v.learnerId)||
    !['memorization','revision','recitation'].includes(String(v.kind))||
    typeof v.editionId!=='string'||!/^[a-zA-Z0-9_.:-]{1,80}$/.test(v.editionId)||
    !integer(v.surah,1,114)||!integer(v.fromAyah,1,286)||
    !integer(v.toAyah,Number(v.fromAyah),286)||
    !integer(v.startPage,1,604)||!integer(v.endPage,Number(v.startPage),604)||
    !integer(v.dueAtMs,0,Number.MAX_SAFE_INTEGER)||
    !integer(v.publishedAtMs,0,Number.MAX_SAFE_INTEGER)||
    typeof v.instructions!=='string'||!v.instructions.trim()||v.instructions.length>500||
    v.status!=='assigned'||v.revision!==1)
    throw new AssignmentError('INVALID_RESPONSE');
  return v as PublishedAssignment;
 });
}
export function assignmentMessage(error:unknown){
 if(error instanceof AssignmentError){
  if(error.status===401)return 'انتهت الجلسة؛ سجّل الدخول من جديد.';
  if(error.status===404||error.status===403)return 'لم تعد صلاحية الوصول للطالب متاحة.';
  if(error.status===409)return 'حدث تعارض في حالة الواجب؛ حدّث القائمة قبل إعادة المحاولة.';
  if(error.status===400)return 'تأكد من نطاق الآيات والموعد والنص المدخل.';
  if(error.code==='SUBMISSION_SCHEMA_NOT_READY')return 'خدمة تسليم الواجبات قيد التجهيز على الخادم.';
  if(error.code==='ASSIGNMENT_SCHEMA_NOT_READY')return 'خدمة الواجبات قيد التجهيز على الخادم.';
 }
 return 'تعذر الاتصال بالواجبات. أعد المحاولة.';
}
export function assignmentClient(transport:typeof fetch=fetch){
 async function request(url:string,input?:unknown,signal?:AbortSignal){
  let res:Response;
  try{res=await transport(url,{method:input===undefined?'GET':'POST',
   credentials:'same-origin',redirect:'error',cache:'no-store',...(signal?{signal}:{}),
   ...(input===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(input)})});}
  catch{throw new AssignmentError('NETWORK_ERROR');}
  let body:Record<string,unknown>;
  try{body=object(await res.json());}
  catch{throw new AssignmentError('INVALID_RESPONSE',res.status);}
  if(!res.ok)throw new AssignmentError(typeof body.code==='string'?body.code:'REQUEST_FAILED',res.status);
  return body;
 }
 function parseTasks(body:Record<string,unknown>){return parsePublishedTasks(body.assignments);}
 return {
  owner:async(id:string,signal?:AbortSignal)=>parseTasks(
   await request('/v1/me/learners/'+checkId(id)+'/assignments',undefined,signal)),
  teacher:async(id:string,signal?:AbortSignal)=>parseTasks(
   await request('/v1/teacher/learners/'+checkId(id)+'/assignments',undefined,signal)),
  catalog:async(signal?:AbortSignal)=>{
   const data=await request('/v1/teacher/assignment-catalog',undefined,signal);
   if(!Array.isArray(data.surahs)||data.surahs.length>1000)
     throw new AssignmentError('INVALID_RESPONSE');
   return data.surahs.map(v=>{
    const q=object(v);
    if(typeof q.editionId!=='string'||!Number.isSafeInteger(q.surah)||!Number.isSafeInteger(q.ayahCount)||
       Number(q.surah)<1||Number(q.surah)>114||Number(q.ayahCount)<1||Number(q.ayahCount)>286)
      throw new AssignmentError('INVALID_RESPONSE');
    return q as AssignmentSource;
   });
  },
  publish:async(id:string,draft:AssignmentDraft,operationId:string,draftId?:string)=>{
   const body=await request('/v1/teacher/learners/'+checkId(id)+'/assignments',
      {...draft,operationId,...(draftId?{draftId}:{})});
   if(body.code!=='ASSIGNMENT_PUBLISHED'&&body.code!=='ASSIGNMENT_ALREADY_PUBLISHED')
     throw new AssignmentError('INVALID_RESPONSE');
   if(typeof body.assignmentId!=='string'||!/^[-a-f\d]{36}$/i.test(body.assignmentId))
     throw new AssignmentError('INVALID_RESPONSE');
   return body.assignmentId;
  },
 };
}
