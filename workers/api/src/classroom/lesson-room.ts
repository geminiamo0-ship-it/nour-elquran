/** Server-only Lesson Durable Object presence leases. No media, no Start/End.
 * The ONLY caller is the authenticated Worker after fresh D1 access checks.
 * Nothing in this file authorizes a user from a request header/JSON role.
 */
export type RoomRole='teacher'|'learner';
export type RoomAction='join'|'heartbeat'|'leave'|'snapshot';
export type VerifiedRoomCommand=Readonly<{
 lessonId:string;
 role:RoomRole;
 actorSubject:string;
 learnerId:string;
 action:RoomAction;
}>;
type Lease=Readonly<{subject:string;learnerId:string;expiresAtMs:number}>;
export type RoomRecord=Readonly<{
 lessonId:string;teacher:Lease|null;learner:Lease|null;
 revision:number;
}>;
export type RoomSnapshot=Readonly<{
 lessonId:string;teacherPresent:boolean;learnerPresent:boolean;
 bothPresent:boolean;revision:number;leaseTtlMs:number;
 mediaReady:false;canStart:false;
}>;
export type RoomResult=
 | {ok:true;code:'ROOM_JOINED'|'ROOM_HEARTBEAT'|'ROOM_LEFT'|'ROOM_SNAPSHOT';state:RoomSnapshot}
 | {ok:false;code:'NOT_JOINED'|'ROOM_ID_MISMATCH'|'ROOM_ACTOR_CONFLICT'};
export const ROOM_LEASE_MS=25_000;
const allowed=/^[a-zA-Z0-9-]{1,128}$/;

export function validVerifiedRoomCommand(v:unknown):v is VerifiedRoomCommand {
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const o=v as Record<string,unknown>;
 return Object.keys(o).length===5&&
  ['lessonId','role','actorSubject','learnerId','action'].every(k=>Object.hasOwn(o,k))&&
  typeof o.lessonId==='string'&&allowed.test(o.lessonId)&&
  typeof o.actorSubject==='string'&&allowed.test(o.actorSubject)&&
  typeof o.learnerId==='string'&&allowed.test(o.learnerId)&&
  (o.role==='teacher'||o.role==='learner')&&
  ['join','heartbeat','leave','snapshot'].includes(String(o.action));
}
function live(lease:Lease|null,now:number){return !!lease&&lease.expiresAtMs>now;}
export function roomSnapshot(state:RoomRecord,now:number):RoomSnapshot {
 const teacherPresent=live(state.teacher,now),learnerPresent=live(state.learner,now);
 return {lessonId:state.lessonId,teacherPresent,learnerPresent,
  bothPresent:teacherPresent&&learnerPresent,revision:state.revision,
  leaseTtlMs:ROOM_LEASE_MS,mediaReady:false,canStart:false};
}
export function applyRoomCommand(state:RoomRecord|null,command:VerifiedRoomCommand,now:number):
 {result:RoomResult;next:RoomRecord|null}{
 const old=state??{lessonId:command.lessonId,teacher:null,learner:null,revision:0};
 if(old.lessonId!==command.lessonId)return {result:{ok:false,code:'ROOM_ID_MISMATCH'},next:state};
 const active=old[command.role];
 if(command.action!=='join'&&command.action!=='snapshot'&&
   (!live(active,now)||active!.subject!==command.actorSubject||
     active!.learnerId!==command.learnerId))
  return {result:{ok:false,code:'NOT_JOINED'},next:state};
 if(command.action==='join'&&live(active,now)&&
   (active!.subject!==command.actorSubject||active!.learnerId!==command.learnerId))
  return {result:{ok:false,code:'ROOM_ACTOR_CONFLICT'},next:state};
 if(command.action==='snapshot')
  return {result:{ok:true,code:'ROOM_SNAPSHOT',state:roomSnapshot(old,now)},next:state};
 const next:RoomRecord={...old,revision:old.revision+1,
  [command.role]:command.action==='leave'?null:{
   subject:command.actorSubject,learnerId:command.learnerId,
   expiresAtMs:now+ROOM_LEASE_MS,
  }};
 const code=command.action==='join'?'ROOM_JOINED':
   command.action==='heartbeat'?'ROOM_HEARTBEAT':'ROOM_LEFT';
 return {result:{ok:true,code,state:roomSnapshot(next,now)},next};
}
export interface LessonRoomStorage {
 get<T>(name:string):Promise<T|undefined>;
 put<T>(name:string,value:T):Promise<void>;
 transaction<T>(fn:(txn:Pick<LessonRoomStorage,'get'|'put'>)=>Promise<T>):Promise<T>;
}
export interface LessonRoomContext {storage:LessonRoomStorage;}
export interface RoomStub {fetch(request:Request):Promise<Response>;}
export interface LessonRoomNamespace {
 idFromName(name:string):unknown;
 get(id:unknown):RoomStub;
}
export class LessonRoom {
 private readonly ctx:LessonRoomContext;
 constructor(ctx:LessonRoomContext){this.ctx=ctx;}
 async fetch(request:Request):Promise<Response>{
  const path=new URL(request.url).pathname;
  if(path!=='/internal/room-presence'||request.method!=='POST')
   return Response.json({code:'NOT_FOUND'},{status:404});
  let value:unknown;
  try{value=await request.json();}catch{return Response.json({code:'INVALID_ROOM_ACTION'},{status:400});}
  if(!validVerifiedRoomCommand(value))
   return Response.json({code:'INVALID_ROOM_ACTION'},{status:400});
  const command=value;const now=Date.now();
  const result=await this.ctx.storage.transaction(async txn=>{
   const old=await txn.get<RoomRecord>('room');
   const applied=applyRoomCommand(old??null,command,now);
   if(applied.next&&applied.next!==old&&command.action!=='snapshot')
    await txn.put('room',applied.next);
   return applied.result;
  });
  if(!result.ok)return Response.json({code:result.code},{status:result.code==='ROOM_ACTOR_CONFLICT'?409:404});
  return Response.json({code:result.code,presence:result.state},
   {headers:{'cache-control':'no-store'}});
 }
}
