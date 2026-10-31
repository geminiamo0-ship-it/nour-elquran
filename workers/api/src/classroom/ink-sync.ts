import type {Env} from '../bindings.ts';
import {parseInkCommand,type InkStroke,type VerifiedInkCommand} from './quran-ink.ts';
export type InkAction=Readonly<
 {action:'snapshot';page:number}|
 {action:'add';page:number;expectedRevision:number;requestId:string;stroke:InkStroke}|
 {action:'hide';page:number;expectedRevision:number;requestId:string;strokeId:string}
>;
export type InkView=Readonly<{page:number;revision:number;strokes:InkStroke[]}>;
export type InkOutcome=Readonly<{status:200|404|409|413|503;code:string;ink?:InkView}>;
export function parseClientInk(value:unknown,role:'teacher'|'learner'):InkAction|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const x=value as Record<string,unknown>;
 // Strip role and identity from the public body by requiring the exact action fields.
 const action=x.action;
 if(action==='snapshot'&&Object.keys(x).length===2){
  const cmd=parseInkCommand({lessonId:'validated',learnerId:'validated',actorSubject:'validated',role,
   action,page:x.page});
  return cmd?{action:'snapshot',page:x.page as number}:null;
 }
 // The Worker may still expose learner GET only until canonical D1 sync is ready.
 // This internal parser keeps the signed role and never accepts browser actor IDs.
 if((action!=='add'&&action!=='hide')||Object.keys(x).length!==5)return null;
 const cmd=parseInkCommand({lessonId:'validated',learnerId:'validated',actorSubject:'validated',
  role,action,page:x.page,expectedRevision:x.expectedRevision,requestId:x.requestId,
  ...(action==='add'?{stroke:x.stroke}:{strokeId:x.strokeId})});
 return cmd?x as InkAction:null;
}
export async function forwardVerifiedInk(env:Env,verified:Readonly<{
 lessonId:string;learnerId:string;actorSubject:string;role:'teacher'|'learner';
}>,action:InkAction):Promise<InkOutcome>{
 if(!env.LESSON_ROOMS)return {status:503,code:'CLASSROOM_ROOM_NOT_CONFIGURED'};
 const command:VerifiedInkCommand={...verified,...action};
 try{
  const stub=env.LESSON_ROOMS.get(env.LESSON_ROOMS.idFromName(verified.lessonId));
  const res=await stub.fetch(new Request('https://lesson-room.internal/internal/quran-ink',{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(command)}));
  const raw:unknown=await res.json();
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('INVALID');
  const x=raw as Record<string,unknown>;
  if(res.status===404&&x.code==='NOT_JOINED')return {status:404,code:'NOT_JOINED'};
  if((res.status===409||res.status===413)&&validInk(x.ink))
   return {status:res.status as 409|413,code:String(x.code),ink:x.ink};
  if(!res.ok)return {status:503,code:'CLASSROOM_INK_UNAVAILABLE'};
  if(!['INK_SNAPSHOT','INK_APPLIED','INK_REPLAY'].includes(String(x.code))||!validInk(x.ink))
   throw Error('INVALID');
  return {status:200,code:String(x.code),ink:x.ink};
 }catch{return {status:503,code:'CLASSROOM_INK_UNAVAILABLE'};}
}
export function validInk(raw:unknown):raw is InkView{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 const s=raw as Record<string,unknown>;
 if(Object.keys(s).length!==3||!Number.isInteger(s.page)||Number(s.page)<1||Number(s.page)>604||
  !Number.isSafeInteger(s.revision)||Number(s.revision)<0||
  !Array.isArray(s.strokes)||s.strokes.length>200)return false;
 // Reuse the same strict stroke validator; snapshots contain no client identities.
 return s.strokes.every((stroke:unknown)=>parseInkCommand({
  lessonId:'validated',learnerId:'validated',actorSubject:'validated',role:'teacher',
  action:'add',page:s.page,expectedRevision:0,requestId:'ink-check-0001',stroke
 })!==null);
}
