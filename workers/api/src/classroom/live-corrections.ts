/** Private acting-Sheikh correction log inside the signed lesson DO.
 * No learner route, automatic publication, generated Quran, or recordings.
 */
import type {Env} from '../bindings.ts';
export type CorrectionKind='memorization'|'recitation'|'tajweed'|'pronunciation'|'general';
export type Correction=Readonly<{
 id:string;operationId:string;page:number;surah:number|null;ayah:number|null;
 kind:CorrectionKind;text:string;atMs:number;
}>;
export type CorrectionsState=Readonly<{revision:number;teacherSubject:string|null;
 items:Correction[]}>;
export type VerifiedCorrectionAction=Readonly<{
 lessonId:string;learnerId:string;actorSubject:string;role:'teacher';
 action:'snapshot'|'seed'|'add';operationId?:string;page?:number;
 surah?:number|null;ayah?:number|null;kind?:CorrectionKind;text?:string;
}>;
const id=/^[A-Za-z0-9-]{1,128}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const kinds=['memorization','recitation','tajweed','pronunciation','general'];
export const initialCorrections=():CorrectionsState=>({revision:0,teacherSubject:null,items:[]});
export type ClientCorrectionAction=Readonly<{action:'add';operationId:string;page:number;
 surah:number|null;ayah:number|null;kind:CorrectionKind;text:string}>;
function validFields(v:Record<string,unknown>){
 return typeof v.operationId==='string'&&uuid.test(v.operationId)&&
  Number.isInteger(v.page)&&Number(v.page)>=1&&Number(v.page)<=604&&
  (v.surah===null||(Number.isInteger(v.surah)&&Number(v.surah)>=1&&Number(v.surah)<=114))&&
  (v.ayah===null||(Number.isInteger(v.ayah)&&Number(v.ayah)>=1&&Number(v.ayah)<=286))&&
  (v.surah===null)===(v.ayah===null)&&kinds.includes(String(v.kind))&&
  (v.kind==='general'||v.surah!==null)&&
  typeof v.text==='string'&&v.text.trim().length>=1&&
  v.text.trim().length<=500&&v.text.length<=600&&
  !Array.from(v.text).some(c=>c.charCodeAt(0)<32&&c!=='\n'&&c!=='\r'&&c!=='\t');
}
export function parseClientCorrection(raw:unknown):ClientCorrectionAction|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const v=raw as Record<string,unknown>;
 if(Object.keys(v).length!==7||v.action!=='add'||
  !['action','operationId','page','surah','ayah','kind','text'].every(k=>Object.hasOwn(v,k))||
  !validFields(v))return null;
 return {...v,text:(v.text as string).trim()} as ClientCorrectionAction;
}
export function parseVerifiedCorrection(raw:unknown):VerifiedCorrectionAction|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const v=raw as Record<string,unknown>;
 if(v.role!=='teacher'||typeof v.lessonId!=='string'||!id.test(v.lessonId)||
  typeof v.learnerId!=='string'||!id.test(v.learnerId)||
  typeof v.actorSubject!=='string'||!id.test(v.actorSubject))return null;
 if(v.action==='snapshot'||v.action==='seed')return Object.keys(v).length===5?
  v as VerifiedCorrectionAction:null;
 if(v.action==='add'&&Object.keys(v).length===11&&validFields(v))
  return v as VerifiedCorrectionAction;
 return null;
}
export function appendCorrection(state:CorrectionsState,cmd:VerifiedCorrectionAction,now:number):
 {code:'CORRECTION_SAVED'|'CORRECTION_REPLAY'|'CORRECTION_CONFLICT'|'CORRECTION_LIMIT';
 state:CorrectionsState}{
 if(state.teacherSubject&&state.teacherSubject!==cmd.actorSubject)
  return {code:'CORRECTION_CONFLICT',state};
 const replay=state.items.find(x=>x.operationId===cmd.operationId);
 if(replay)return {code:replay.page===cmd.page&&replay.surah===cmd.surah&&
   replay.ayah===cmd.ayah&&replay.kind===cmd.kind&&replay.text===cmd.text?
   'CORRECTION_REPLAY':'CORRECTION_CONFLICT',state};
 if(state.items.length>=120)return {code:'CORRECTION_LIMIT',state};
 const item:Correction={id:crypto.randomUUID(),operationId:cmd.operationId!,page:cmd.page!,
  surah:cmd.surah!,ayah:cmd.ayah!,kind:cmd.kind!,text:cmd.text!,atMs:now};
 return {code:'CORRECTION_SAVED',state:{revision:state.revision+1,
  teacherSubject:cmd.actorSubject,items:[...state.items,item]}};
}
export async function forwardCorrections(env:Env,actor:Omit<VerifiedCorrectionAction,'action'>,
 action:'snapshot'|'seed'|ClientCorrectionAction):Promise<
 {status:200|400|404|409|413|503;code:string;corrections?:{revision:number;items:Correction[]}}>{
 if(!env.LESSON_ROOMS)return {status:503,code:'CLASSROOM_ROOM_NOT_CONFIGURED'};
 try{
  const cmd={...actor,...(typeof action==='string'?{action}:action)};
  const stub=env.LESSON_ROOMS.get(env.LESSON_ROOMS.idFromName(actor.lessonId));
  const response=await stub.fetch(new Request('https://lesson-room.internal/internal/corrections',{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(cmd)
  }));
  const raw:unknown=await response.json();
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('INVALID');
  const data=raw as Record<string,unknown>;
  if(!response.ok){
   if(response.status===404&&data.code==='NOT_JOINED')return {status:404,code:'NOT_JOINED'};
   if(response.status===409&&data.code==='CORRECTION_CONFLICT')return {status:409,code:'CORRECTION_CONFLICT'};
   if(response.status===413&&data.code==='CORRECTION_LIMIT')return {status:413,code:'CORRECTION_LIMIT'};
   return {status:503,code:'CLASSROOM_CORRECTIONS_UNAVAILABLE'};
  }
  const list=data.corrections;
  if(!list||typeof list!=='object'||Array.isArray(list))throw Error('INVALID');
  const v=list as Record<string,unknown>;
  if(!Number.isSafeInteger(v.revision)||Number(v.revision)<0||!Array.isArray(v.items)||
   v.items.length>120||!v.items.every(x=>x&&typeof x==='object'&&!Array.isArray(x)&&
    typeof (x as Correction).text==='string'&&(x as Correction).text.length<=500&&
    typeof (x as Correction).id==='string'))throw Error('INVALID');
  return {status:200,code:String(data.code),corrections:list as {revision:number;items:Correction[]}};
 }catch{return {status:503,code:'CLASSROOM_CORRECTIONS_UNAVAILABLE'};}
}
