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
const uuidV4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const color=/^#[0-9a-f]{6}$/i;
function reject():never{throw new TeacherDraftError('INVALID_DRAFT_RESPONSE');}
const exact=(value:Record<string,unknown>,keys:readonly string[])=>
 Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
function validMark(raw:unknown):raw is TeacherInkMark{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 const mark=raw as Record<string,unknown>;
 if(!exact(mark,['id','kind','page','surah','ayah','payload'])||
  typeof mark.id!=='string'||!/^[A-Za-z0-9_-]{8,40}$/.test(mark.id)||
  !['pen','marker','note','highlight'].includes(String(mark.kind))||
  !Number.isSafeInteger(mark.page)||Number(mark.page)<1||Number(mark.page)>604||
  !mark.payload||typeof mark.payload!=='object'||Array.isArray(mark.payload))return false;
 const payload=mark.payload as Record<string,unknown>;
 if(typeof payload.color!=='string'||!color.test(payload.color))return false;
 if(mark.kind==='pen'||mark.kind==='marker'){
  if(mark.surah!==null||mark.ayah!==null||!exact(payload,['color','width','points'])||
   typeof payload.width!=='number'||!Number.isFinite(payload.width)||
   payload.width<1||payload.width>60||
   !Array.isArray(payload.points)||payload.points.length<2||payload.points.length>600)return false;
  return payload.points.every((p:unknown)=>{
   if(!p||typeof p!=='object'||Array.isArray(p))return false;
   const point=p as Record<string,unknown>;
   return exact(point,['x','y'])&&typeof point.x==='number'&&Number.isFinite(point.x)&&
    point.x>=0&&point.x<=1000&&typeof point.y==='number'&&Number.isFinite(point.y)&&
    point.y>=0&&point.y<=1594;
  });
 }
 if(!Number.isSafeInteger(mark.surah)||Number(mark.surah)<1||Number(mark.surah)>114||
  !Number.isSafeInteger(mark.ayah)||Number(mark.ayah)<1)return false;
 return mark.kind==='note'?
  exact(payload,['color','text'])&&typeof payload.text==='string'&&
   payload.text.trim().length>0&&payload.text.length<=500:
  exact(payload,['color']);
}
/** Fail closed on a foreign learner, forged draft, or malformed nested marks.
 * The server remains the authority; this prevents trusting an incorrect UI ACK.
 */
export function parseTeacherInkDraft(raw:unknown,expectedLearnerId:string):SavedInkDraft{
 const o=obj(raw);
 if(!exact(o,['draftId','revision','learnerId','kind','editionId','surah',
   'fromAyah','toAyah','dueAtMs','instructions','marks','updatedAtMs'])||
  typeof o.draftId!=='string'||!uuidV4.test(o.draftId)||
  !Number.isSafeInteger(o.revision)||Number(o.revision)<1||Number(o.revision)>1000||
  o.learnerId!==expectedLearnerId||
  !['memorization','revision','recitation'].includes(String(o.kind))||
  typeof o.editionId!=='string'||!/^[A-Za-z0-9_.:-]{1,80}$/.test(o.editionId)||
  !Number.isSafeInteger(o.surah)||Number(o.surah)<1||Number(o.surah)>114||
  !Number.isSafeInteger(o.fromAyah)||Number(o.fromAyah)<1||
  !Number.isSafeInteger(o.toAyah)||Number(o.toAyah)<Number(o.fromAyah)||
  !Number.isSafeInteger(o.dueAtMs)||Number(o.dueAtMs)<0||
  typeof o.instructions!=='string'||!o.instructions.trim()||
  o.instructions.length>500||
  !Number.isSafeInteger(o.updatedAtMs)||Number(o.updatedAtMs)<0||
  !Array.isArray(o.marks)||o.marks.length>24)return reject();
 const seen=new Set<string>();
 for(const m of o.marks){
  if(!validMark(m)||seen.has(m.id))return reject();
  seen.add(m.id);
 }
 return o as SavedInkDraft;
}

export const teacherInkDraftClient={
 list:async(learnerId:string,signal?:AbortSignal)=>{
  const data=await send(draftPath(learnerId),undefined,signal);
  if(!Array.isArray(data.drafts)||data.drafts.length>30)
   throw new TeacherDraftError('INVALID_DRAFT_RESPONSE');
  const drafts=data.drafts.map((draft:unknown)=>parseTeacherInkDraft(draft,learnerId));
  if(new Set(drafts.map(d=>d.draftId)).size!==drafts.length)
   throw new TeacherDraftError('INVALID_DRAFT_RESPONSE');
  return drafts;
 },
 save:async(learnerId:string,draft:AssignmentDraft,draftId:string,revision:number,
  marks:readonly TeacherInkMark[])=>{
  const data=await send(draftPath(learnerId),{...draft,draftId,revision,marks});
  if(data.code!=='DRAFT_SAVED'&&data.code!=='DRAFT_ALREADY_SAVED')
   throw new TeacherDraftError('INVALID_DRAFT_RESPONSE');
  const saved=parseTeacherInkDraft(data.draft,learnerId);
  // An ACK is authoritative only for the exact submitted identity, revision,
  // immutable assignment fields, and all ink. It must not claim another
  // teacher's/student's draft was saved on a stale or malformed response.
  if(saved.draftId!==draftId||saved.revision!==revision||
   saved.kind!==draft.kind||saved.editionId!==draft.editionId||
   saved.surah!==draft.surah||saved.fromAyah!==draft.fromAyah||
   saved.toAyah!==draft.toAyah||saved.dueAtMs!==draft.dueAtMs||
   saved.instructions!==draft.instructions||
   JSON.stringify(saved.marks)!==JSON.stringify(marks))
   throw new TeacherDraftError('INVALID_DRAFT_RESPONSE');
  return saved;
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
