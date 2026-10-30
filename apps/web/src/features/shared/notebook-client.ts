/** Strict same-origin, account-owned notebook transport; never trusts browser roles. */
export type LessonRow=Readonly<{
 id:string;learnerId:string;status:'scheduled'|'live'|'completed'|'cancelled';
 kind:'trial'|'standard'|'makeup';startsAtMs:number;endsAtMs:number;
}>;
export type PrivateNote=Readonly<{
 id:string;body:string;version:number;updatedAtMs:number;
}>;
export class NotebookApiError extends Error{
 constructor(readonly code:string,readonly status=0){super(code);}
}
const object=(v:unknown):Record<string,unknown>=>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw new NotebookApiError('INVALID_RESPONSE');
 return v as Record<string,unknown>;
};
const validId=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,128}$/.test(v);
const timestamp=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
export function parseNotebookLessons(raw:unknown):readonly LessonRow[]{
 const value=object(raw),list=value.lessons;
 if(!Array.isArray(list)||list.length>50)throw new NotebookApiError('INVALID_RESPONSE');
 return list.map(item=>{
  const row=object(item);
  if(!validId(row.id)||!validId(row.learnerId)||
    !['scheduled','live','completed','cancelled'].includes(String(row.status))||
    !['trial','standard','makeup'].includes(String(row.kind))||
    !timestamp(row.startsAtMs)||!timestamp(row.endsAtMs)||
    Number(row.endsAtMs)<=Number(row.startsAtMs))
   throw new NotebookApiError('INVALID_RESPONSE');
  return {id:row.id as string,learnerId:row.learnerId as string,
   status:row.status as LessonRow['status'],kind:row.kind as LessonRow['kind'],
   startsAtMs:row.startsAtMs as number,endsAtMs:row.endsAtMs as number};
 });
}
export function parseNotebookNotes(raw:unknown):readonly PrivateNote[]{
 const notes=object(raw).notes;
 if(!Array.isArray(notes)||notes.length>100)throw new NotebookApiError('INVALID_RESPONSE');
 const parsed=notes.map(item=>{
  const n=object(item);
  if(!validId(n.id)||typeof n.body!=='string'||n.body.trim().length<1||n.body.length>500||
     !Number.isSafeInteger(n.version)||Number(n.version)<1||!timestamp(n.updatedAtMs))
   throw new NotebookApiError('INVALID_RESPONSE');
  return {id:n.id as string,body:n.body,version:n.version as number,updatedAtMs:n.updatedAtMs as number};
 });
 if(new Set(parsed.map(n=>n.id)).size!==parsed.length)throw new NotebookApiError('INVALID_RESPONSE');
 return parsed;
}
async function call(path:string,command?:unknown,signal?:AbortSignal):Promise<unknown>{
 let response:Response;
 try {response=await fetch(path,{method:command?'POST':'GET',credentials:'same-origin',
    cache:'no-store',redirect:'error',...(command?{headers:{'content-type':'application/json'},
    body:JSON.stringify(command)}:{}),...(signal?{signal}:{})});}
 catch(e){if(signal?.aborted)throw e;throw new NotebookApiError('NETWORK_UNCERTAIN');}
 let data:unknown;
 try{data=await response.json();}catch{throw new NotebookApiError('INVALID_RESPONSE',response.status);}
 if(!response.ok){const code=object(data).code;
  throw new NotebookApiError(typeof code==='string'?code:'REQUEST_FAILED',response.status);}
 return data;
}
const enc=encodeURIComponent;
const path=(learnerId:string,lessonId:string)=>
 '/v1/me/learners/'+enc(learnerId)+'/lessons/'+enc(lessonId)+'/notebook-notes';
export const notebookClient={
 lessons:async(learnerId:string,signal?:AbortSignal)=>parseNotebookLessons(await call(
   '/v1/me/learners/'+enc(learnerId)+'/lessons',undefined,signal)),
 notes:async(learnerId:string,lessonId:string,signal?:AbortSignal)=>
   parseNotebookNotes(await call(path(learnerId,lessonId),undefined,signal)),
 save:async(learnerId:string,lessonId:string,noteId:string,expectedVersion:number,
  body:string,operationId:string)=>call(path(learnerId,lessonId),
    {action:'put',operationId,noteId,expectedVersion,body}),
 hide:async(learnerId:string,lessonId:string,noteId:string,expectedVersion:number,
  operationId:string)=>call(path(learnerId,lessonId),
    {action:'hide',operationId,noteId,expectedVersion,body:''}),
};
export function notebookError(error:unknown){
 const code=error instanceof NotebookApiError?error.code:'UNKNOWN';
 if(code==='NOTEBOOK_VERSION_CONFLICT')return 'الملاحظة تغيرت في جلسة أخرى. حدّث الصفحة قبل التعديل.';
 if(code==='NOT_FOUND')return 'الحصة غير مكتملة أو لم يعد الحساب مصرحًا بعرضها.';
 return 'تعذر تأكيد العملية. أعد قراءة الملاحظات قبل المحاولة من جديد.';
}
