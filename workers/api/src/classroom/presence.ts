import type {Env} from '../bindings.ts';
import type {VerifiedRoomCommand,RoomSnapshot} from './lesson-room.ts';

export type ClientPresenceAction='join'|'heartbeat'|'leave';
export function parseClientPresenceAction(raw:unknown):ClientPresenceAction|null {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const obj=raw as Record<string,unknown>;
 if(Object.keys(obj).length!==1||!Object.hasOwn(obj,'action'))return null;
 return obj.action==='join'||obj.action==='heartbeat'||obj.action==='leave'?obj.action:null;
}
export type SafePresenceResponse=
 | Readonly<{status:200;code:string;presence:RoomSnapshot}>
 | Readonly<{status:409|404|503;code:string}>;
/**
 * Only the freshly authorized Better Auth route constructs this command.
 * A browser has NO route to pass actorSubject, role or learnerId to a DO.
 */
export async function forwardVerifiedPresence(env:Env,verified:Readonly<{
 lessonId:string;learnerId:string;actorSubject:string;role:'teacher'|'learner';
}>,action:VerifiedRoomCommand['action']):Promise<SafePresenceResponse>{
 if(!env.LESSON_ROOMS)return {status:503,code:'CLASSROOM_ROOM_NOT_CONFIGURED'};
 const command:VerifiedRoomCommand={...verified,action};
 try{
  const stub=env.LESSON_ROOMS.get(env.LESSON_ROOMS.idFromName(verified.lessonId));
  const res=await stub.fetch(new Request('https://lesson-room.internal/internal/room-presence',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify(command),
  }));
  const payload:unknown=await res.json();
  if(!payload||typeof payload!=='object'||Array.isArray(payload))
   return {status:503,code:'CLASSROOM_ROOM_UNAVAILABLE'};
  const data=payload as Record<string,unknown>;
  if(!res.ok){
   const allowed=['NOT_JOINED','ROOM_ID_MISMATCH','ROOM_ACTOR_CONFLICT'];
   if((res.status===404||res.status===409)&&allowed.includes(String(data.code)))
    return {status:res.status as 404|409,code:data.code as string};
   return {status:503,code:'CLASSROOM_ROOM_UNAVAILABLE'};
  }
  const p=data.presence;
  if(!p||typeof p!=='object'||Array.isArray(p))return {status:503,code:'CLASSROOM_ROOM_UNAVAILABLE'};
  const s=p as Record<string,unknown>;
  if(s.lessonId!==verified.lessonId||
    typeof s.teacherPresent!=='boolean'||typeof s.learnerPresent!=='boolean'||
    s.bothPresent!==(s.teacherPresent&&s.learnerPresent)||
    !Number.isSafeInteger(s.revision)||!Number.isSafeInteger(s.leaseTtlMs)||
    s.mediaReady!==false||s.canStart!==false)
   return {status:503,code:'CLASSROOM_ROOM_UNAVAILABLE'};
  return {status:200,code:String(data.code),presence:s as unknown as RoomSnapshot};
 }catch{return {status:503,code:'CLASSROOM_ROOM_UNAVAILABLE'};}
}
