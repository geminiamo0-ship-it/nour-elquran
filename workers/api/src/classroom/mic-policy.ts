/** Persistent, signed lesson-room microphone moderation. Release does NOT
 * remotely enable a learner's device: the learner must explicitly turn it on.
 */
import type {Env} from '../bindings.ts';

export type MicPolicy=Readonly<{locked:boolean;revision:number}>;
export type VerifiedMicCommand=Readonly<{
 lessonId:string;learnerId:string;actorSubject:string;role:'teacher'|'learner';
 action:'snapshot'|'lock'|'release';
}>;
const id=/^[a-zA-Z0-9-]{1,128}$/;
export function parseVerifiedMicCommand(raw:unknown):VerifiedMicCommand|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const v=raw as Record<string,unknown>;
 if(Object.keys(v).length!==5||
  !['lessonId','learnerId','actorSubject','role','action'].every(k=>Object.hasOwn(v,k))||
  ![v.lessonId,v.learnerId,v.actorSubject].every(x=>typeof x==='string'&&id.test(x))||
  (v.role!=='teacher'&&v.role!=='learner')||
  !['snapshot','lock','release'].includes(String(v.action))||
  (v.role==='learner'&&v.action!=='snapshot'))return null;
 return v as VerifiedMicCommand;
}
export const initialMicPolicy=():MicPolicy=>({locked:false,revision:0});
export function applyMicPolicy(current:MicPolicy,action:'lock'|'release'):MicPolicy{
 const locked=action==='lock';
 if(current.locked===locked)return current;
 return {locked,revision:current.revision+1};
}
function validPolicy(raw:unknown):raw is MicPolicy{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 const o=raw as Record<string,unknown>;
 return Object.keys(o).length===2&&typeof o.locked==='boolean'&&
  Number.isSafeInteger(o.revision)&&Number(o.revision)>=0;
}
export async function forwardVerifiedMicPolicy(env:Env,actor:Omit<VerifiedMicCommand,'action'>,
 action:'snapshot'|'lock'|'release'):Promise<{status:200;code:string;policy:MicPolicy}|{status:404|503;code:string}>{
 if(!env.LESSON_ROOMS)return {status:503,code:'CLASSROOM_ROOM_NOT_CONFIGURED'};
 try{
  const stub=env.LESSON_ROOMS.get(env.LESSON_ROOMS.idFromName(actor.lessonId));
  const response=await stub.fetch(new Request('https://lesson-room.internal/internal/learner-microphone-policy',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({...actor,action}),
  }));
  const raw:unknown=await response.json();
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('INVALID');
  const data=raw as Record<string,unknown>;
  if(response.status===404&&data.code==='NOT_JOINED')return {status:404,code:'NOT_JOINED'};
  if(!response.ok||!validPolicy(data.policy)||
   !['MIC_POLICY_SNAPSHOT','MIC_POLICY_LOCKED','MIC_POLICY_RELEASED'].includes(String(data.code)))
   throw Error('INVALID');
  return {status:200,code:String(data.code),policy:data.policy};
 }catch{return {status:503,code:'MIC_POLICY_UNAVAILABLE'};}
}
