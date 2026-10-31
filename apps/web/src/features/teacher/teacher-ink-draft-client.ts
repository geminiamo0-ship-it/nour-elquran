import type {AssignmentDraft} from '../shared';

export type TeacherInkMark=Readonly<{
 id:string;kind:'pen'|'marker'|'note'|'highlight';page:number;
 surah:number|null;ayah:number|null;
 payload:Readonly<Record<string,unknown>>;
}>;
export type SavedInkDraft=AssignmentDraft&Readonly<{
 draftId:string;revision:number;learnerId:string;
 marks:readonly TeacherInkMark[];updatedAtMs:number;
}>;
export type PageRange=Readonly<{startPage:number;endPage:number}>;
export class TeacherDraftError extends Error{
 constructor(readonly code:string,readonly status=0){super(code);}
}
const id=(raw:string)=>{
 if(!/^[A-Za-z0-9-]{1,128}$/.test(raw))throw new TeacherDraftError('INVALID_LEARNER');
 return raw;
};
const obj=(raw:unknown):Record<string,unknown>=>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))
  throw new TeacherDraftError('INVALID_DRAFT_RESPONSE');
 return raw as Record<string,unknown>;
};
async function send(url:string,input?:unknown,signal?:AbortSignal){
 let response:Response;
 try{response=await fetch(url,{method:input===undefined?'GET':'POST',
  credentials:'same-origin',cache:'no-store',redirect:'error',
  ...(input===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(input)}),
  ...(signal?{signal}:{})});}
 catch{throw new TeacherDraftError('NETWORK_FAILURE');}
 let data:Record<string,unknown>;
 try{data=obj(await response.json());}catch{throw new TeacherDraftError('INVALID_DRAFT_RESPONSE');}
 if(!response.ok)throw new TeacherDraftError(typeof data.code==='string'?data.code:'DRAFT_REQUEST_FAILED',response.status);
 return data;
}
const draftPath=(learnerId:string)=>'/v1/teacher/learners/'+encodeURIComponent(id(learnerId))+'/assignment-drafts';
function parsedDraft(raw:unknown):SavedInkDraft{
 const o=obj(raw);
 if(typeof o.draftId!=='string'||!/^[0-9a-f-]{36}$/i.test(o.draftId)||
  !Number.isSafeInteger(o.revision)||Number(o.revision)<1||
  typeof o.learnerId!=='string'||!Array.isArray(o.marks)||o.marks.length>24||
  !['memorization','revision','recitation'].includes(String(o.kind))||
  typeof o.editionId!=='string'||!Number.isInteger(o.surah)||
  !Number.isInteger(o.fromAyah)||!Number.isInteger(o.toAyah)||
  !Number.isSafeInteger(o.dueAtMs)||typeof o.instructions!=='string'||
  !Number.isSafeInteger(o.updatedAtMs))throw new TeacherDraftError('INVALID_DRAFT_RESPONSE');
 for(const m of o.marks){
  const mark=obj(m);
  if(typeof mark.id!=='string'||!['pen','marker','note','highlight'].includes(String(mark.kind))||
   !Number.isInteger(mark.page)||Number(mark.page)<1||Number(mark.page)>604||
   !mark.payload||typeof mark.payload!=='object'||Array.isArray(mark.payload))
   throw new TeacherDraftError('INVALID_DRAFT_RESPONSE');
 }
 return o as SavedInkDraft;
}
export const teacherInkDraftClient={
 list:async(learnerId:string,signal?:AbortSignal)=>{
  const data=await send(draftPath(learnerId),undefined,signal);
  if(!Array.isArray(data.drafts)||data.drafts.length>30)
   throw new TeacherDraftError('INVALID_DRAFT_RESPONSE');
  return data.drafts.map(parsedDraft);
 },
 save:async(learnerId:string,draft:AssignmentDraft,draftId:string,revision:number,
  marks:readonly TeacherInkMark[])=>{
  const data=await send(draftPath(learnerId),{...draft,draftId,revision,marks});
  if(data.code!=='DRAFT_SAVED'&&data.code!=='DRAFT_ALREADY_SAVED')
   throw new TeacherDraftError('INVALID_DRAFT_RESPONSE');
  return parsedDraft(data.draft);
 },
 range:async(learnerId:string,draft:AssignmentDraft,signal?:AbortSignal)=>{
  const params=new URLSearchParams({editionId:draft.editionId,
   surah:String(draft.surah),fromAyah:String(draft.fromAyah),toAyah:String(draft.toAyah)});
  const data=await send('/v1/teacher/learners/'+encodeURIComponent(id(learnerId))+
    '/assignment-page-range?'+params,undefined,signal);
  if(data.code!=='DRAFT_RANGE'||!Number.isInteger(data.startPage)||
   !Number.isInteger(data.endPage)||Number(data.startPage)<1||
   Number(data.endPage)<Number(data.startPage)||Number(data.endPage)>604)
   throw new TeacherDraftError('INVALID_DRAFT_RESPONSE');
  return {startPage:data.startPage,endPage:data.endPage} as PageRange;
 }
};
