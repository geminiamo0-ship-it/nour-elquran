/** Server-only Lesson Durable Object presence leases. No media, no Start/End.
 * The ONLY caller is the authenticated Worker after fresh D1 access checks.
 * Nothing in this file authorizes a user from a request header/JSON role.
 */
export type RoomRole='teacher'|'learner';
import type {Env} from '../bindings.ts';
import {checkTeacherClassroomAccess,checkOwnedLearnerClassroomAccess} from '../classroom-access.ts';
import {mediaLessonWindow} from './livekit-token.ts';
import {evictVerifiedLiveKitActor} from './livekit-admin.ts';
import {parseVerifiedPageCommand,initialPage,applyPageSet,safePage,type SharedPageRecord} from './quran-page.ts';
import {parseInkCommand,initialInk,visibleInk,applyInk,type InkPage} from './quran-ink.ts';
import {prepareCumulativeInkDelivery,queueCumulativeInk,type PendingQuranInk}
 from './ink-cumulative-outbox.ts';
import {appendQuranLedgerEvent} from '../learner-quran-ledger.ts';
import {parseVerifiedMicCommand,initialMicPolicy,applyMicPolicy,type MicPolicy} from './mic-policy.ts';
import {parseVerifiedCorrection,initialCorrections,appendCorrection,type CorrectionsState} from './live-corrections.ts';

export type RoomAction='join'|'heartbeat'|'leave'|'snapshot'|'media-intent';
export type VerifiedRoomCommand=Readonly<{
 lessonId:string;
 role:RoomRole;
 actorSubject:string;
 learnerId:string;
 action:RoomAction;
}>;
type Lease=Readonly<{subject:string;learnerId:string;expiresAtMs:number;mediaIntent?:boolean}>;
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
 | {ok:true;code:'ROOM_JOINED'|'ROOM_HEARTBEAT'|'ROOM_LEFT'|'ROOM_SNAPSHOT'|'ROOM_MEDIA_INTENT';state:RoomSnapshot}
 | {ok:false;code:'NOT_JOINED'|'ROOM_ID_MISMATCH'|'ROOM_ACTOR_CONFLICT'|'ROOM_EVICTION_PENDING'};
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
  ['join','heartbeat','leave','snapshot','media-intent'].includes(String(o.action));
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
   mediaIntent:command.action==='media-intent'||(live(active,now)&&active!.mediaIntent===true),
  }};
 const code=command.action==='join'?'ROOM_JOINED':
   command.action==='heartbeat'?'ROOM_HEARTBEAT':
   command.action==='media-intent'?'ROOM_MEDIA_INTENT':'ROOM_LEFT';
 return {result:{ok:true,code,state:roomSnapshot(next,now)},next};
}
export interface LessonRoomStorage {
 get<T>(name:string):Promise<T|undefined>;
 put<T>(name:string,value:T):Promise<void>;
 transaction<T>(fn:(txn:Pick<LessonRoomStorage,'get'|'put'|'setAlarm'>)=>Promise<T>):Promise<T>;
 setAlarm?(timeMs:number):Promise<void>;
}
export interface LessonRoomContext {storage:LessonRoomStorage;}
export interface RoomStub {fetch(request:Request):Promise<Response>;}
export interface LessonRoomNamespace {
 idFromName(name:string):unknown;
 get(id:unknown):RoomStub;
}
/** Durable outbox entry contains only server-verified actor, never a client room.
 * At most 16 outstanding identities can occupy a lesson room; overflow blocks
 * new joins/media and is an operational alert, not data loss.
 */
export type PendingMediaEviction=Readonly<{
 id:string;lessonId:string;learnerId:string;role:RoomRole;actorSubject:string;
}>;
const MAX_OUTBOX=16,RECONCILE_MS=10_000;
function sameActor(p:PendingMediaEviction,c:VerifiedRoomCommand):boolean{
 return p.lessonId===c.lessonId&&p.learnerId===c.learnerId&&
  p.role===c.role&&p.actorSubject===c.actorSubject;
}
function jobFor(room:RoomRecord,role:RoomRole,lease:Lease):PendingMediaEviction{
 return {id:crypto.randomUUID(),lessonId:room.lessonId,role,
  learnerId:lease.learnerId,actorSubject:lease.subject};
}
function enqueue(outbox:PendingMediaEviction[],room:RoomRecord,role:RoomRole,lease:Lease){
 if(!lease.mediaIntent)return;
 if(outbox.some(j=>j.lessonId===room.lessonId&&j.role===role&&
  j.actorSubject===lease.subject&&j.learnerId===lease.learnerId))return;
 if(outbox.length>=MAX_OUTBOX)throw Error('ROOM_EVICTION_OUTBOX_FULL');
 outbox.push(jobFor(room,role,lease));
}
export class LessonRoom {
 private readonly ctx:LessonRoomContext;
 private readonly env:Env|undefined;
 private inkFlush:Promise<void>|undefined;
 constructor(ctx:LessonRoomContext,env?:Env){this.ctx=ctx;this.env=env;}
 private async scheduleNext(now:number):Promise<void>{
  if(!this.ctx.storage.setAlarm)return;
  const [room,outbox,ink]=await Promise.all([
   this.ctx.storage.get<RoomRecord>('room'),
   this.ctx.storage.get<PendingMediaEviction[]>('pendingEvictions'),
   this.ctx.storage.get<PendingQuranInk[]>('pendingQuranInk')
  ]);
  if((outbox?.length??0)>0||(ink?.length??0)>0||
   room?.teacher?.mediaIntent||room?.learner?.mediaIntent)
   await this.ctx.storage.setAlarm(now+RECONCILE_MS);
 }
 private async queued(now:number,command:VerifiedRoomCommand):Promise<RoomResult>{
  const result=await this.ctx.storage.transaction(async txn=>{
   const room=await txn.get<RoomRecord>('room');
   const old=room??{lessonId:command.lessonId,teacher:null,learner:null,revision:0};
   const pending=[...(await txn.get<PendingMediaEviction[]>('pendingEvictions')??[])];
   if(old.lessonId!==command.lessonId)
    return {ok:false,code:'ROOM_ID_MISMATCH'} as RoomResult;
   // Remove expired role leases and enqueue any pre-existing media intent
   // before permitting a replacement participant with the same LiveKit ID.
   let current=old;
   for(const role of ['teacher','learner'] as const){
    const lease=current[role];
    if(lease&&lease.expiresAtMs<=now){
     enqueue(pending,current,role,lease);
     current={...current,[role]:null,revision:current.revision+1};
    }
   }
   if(pending.some(j=>sameActor(j,command))&&command.action!=='leave'&&
      command.action!=='snapshot'){
     await txn.put('room',current);await txn.put('pendingEvictions',pending);
     return {ok:false,code:'ROOM_EVICTION_PENDING'} as RoomResult;
   }
   const before=current[command.role];
   const applied=applyRoomCommand(current,command,now);
   if(applied.next&&applied.next!==current){
    if(command.action==='leave'&&before)enqueue(pending,current,command.role,before);
    await txn.put('room',applied.next);
   }else if(current!==old)await txn.put('room',current);
   if(pending.length>0)await txn.put('pendingEvictions',pending);
   return applied.result;
  });
  return result;
 }
 private async authorized(lease:Lease,role:RoomRole,lessonId:string,now:number):Promise<boolean>{
  if(!this.env?.DB)return false;
  try{
   let access;
   if(role==='teacher')
    access=await checkTeacherClassroomAccess(this.env.DB,lease.subject,lessonId,now);
   else{
    const owner=await this.env.DB.prepare(
     "SELECT id FROM accounts WHERE auth_subject=? AND status='active'"
    ).bind(lease.subject).first<{id:string}>();
    access=owner?.id?await checkOwnedLearnerClassroomAccess(
     this.env.DB,owner.id,lease.learnerId,lessonId):null;
   }
   return !!access&&access.learnerId===lease.learnerId&&mediaLessonWindow(access,now);
  }catch{return false;} // Authorization uncertainty must NOT allow media.
 }
 private async dispatch(now:number):Promise<void>{
  const outbox=await this.ctx.storage.get<PendingMediaEviction[]>('pendingEvictions')??[];
  if(!outbox.length)return;
  // All entries have come from verified server-side room leases; no client
  // can supply a room or arbitrary provider participant identity.
  for(const job of outbox){
   if(!this.env)break;
   const outcome=await evictVerifiedLiveKitActor(this.env,{
    lessonId:job.lessonId,learnerId:job.learnerId,role:job.role,
    actorSubject:job.actorSubject
   },now);
   if(outcome!=='removed')continue;
   await this.ctx.storage.transaction(async txn=>{
    const pending=await txn.get<PendingMediaEviction[]>('pendingEvictions')??[];
    await txn.put('pendingEvictions',pending.filter(x=>x.id!==job.id));
   });
  }
 }

 /** Only the real D1 ledger ACK, never a DO snapshot or successful enqueue,
  * allows a browser to treat a mark as saved to the cumulative Mushaf.
  * A failed/ambiguous write is retained at the queue head for alarm replay.
  */
 private async flushQuranInk():Promise<void>{
  if(this.inkFlush)return this.inkFlush;
  const work=(async()=>{
   if(!this.env?.DB)return;
   for(let i=0;i<64;i++){
    const pending=await this.ctx.storage.get<PendingQuranInk[]>('pendingQuranInk')??[];
    const head=pending[0];
    if(!head)break;
    try{
     const result=await appendQuranLedgerEvent(this.env.DB,
      {subject:head.actorSubject,role:head.actorRole},
      head.learnerId,head.command,head.acceptedAtMs);
     if(result.code!=='QURAN_EVENT_COMMITTED'&&result.code!=='QURAN_EVENT_REPLAY')
      break;
     // Idempotent D1 operation ID makes replay safe if the DO crashes between
     // its D1 ACK and removing the event from SQLite-backed DO storage.
     await this.ctx.storage.transaction(async txn=>{
      const current=await txn.get<PendingQuranInk[]>('pendingQuranInk')??[];
      if(current[0]?.operationId===head.operationId)
       await txn.put('pendingQuranInk',current.slice(1));
     });
    }catch{break;}
   }
  })();
  this.inkFlush=work;
  try{await work;}finally{if(this.inkFlush===work)this.inkFlush=undefined;}
 }
 /** D1 is authoritative for phase: even a lost End callback cannot permit
  * post-completion DO writes that the immutable D1 trigger would reject.
  */
 private async liveInkLesson(lessonId:string,learnerId:string):Promise<boolean>{
  if(!this.env?.DB)return false;
  const row=await this.env.DB.prepare(
   "SELECT status FROM lessons WHERE id=? AND learner_id=?"
  ).bind(lessonId,learnerId).first<{status:string}>();
  return row?.status==='live';
 }
 private async inkEndFence(raw:unknown):Promise<Response>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))
   return Response.json({code:'INVALID_INK_FENCE'},{status:400});
  const c=raw as Record<string,unknown>;
  if(Object.keys(c).length!==5||
    !['lessonId','learnerId','actorSubject','operationId','action'].every(k=>Object.hasOwn(c,k))||
    typeof c.lessonId!=='string'||!allowed.test(c.lessonId)||
    typeof c.learnerId!=='string'||!allowed.test(c.learnerId)||
    typeof c.actorSubject!=='string'||!allowed.test(c.actorSubject)||
    typeof c.operationId!=='string'||!allowed.test(c.operationId)||
    !['prepare','release','complete'].includes(String(c.action)))
   return Response.json({code:'INVALID_INK_FENCE'},{status:400});
  const now=Date.now();
  if(c.action==='prepare')await this.flushQuranInk();
  const result=await this.ctx.storage.transaction(async txn=>{
   const room=await txn.get<RoomRecord>('room');
   if(!room||room.lessonId!==c.lessonId||
     room.teacher?.subject!==c.actorSubject||
     room.teacher?.learnerId!==c.learnerId)
    return {code:'NOT_JOINED',status:404};
   const old=await txn.get<{operationId:string;subject:string;completed:boolean}>('inkEndFence');
   if(c.action==='release'){
    if(old?.operationId===c.operationId&&old.subject===c.actorSubject&&!old.completed)
     await txn.put('inkEndFence',null);
    return {code:'INK_FENCE_RELEASED',status:200};
   }
   if(c.action==='complete'){
    if(!old||old.operationId!==c.operationId||old.subject!==c.actorSubject)
     return {code:'INK_END_FENCE_CONFLICT',status:409};
    await txn.put('inkEndFence',{...old,completed:true});
    return {code:'INK_FENCE_COMPLETED',status:200};
   }
   if(old&&(old.completed||old.subject!==c.actorSubject||
     old.operationId!==c.operationId))
    return {code:'INK_END_FENCE_CONFLICT',status:409};
   if((await txn.get<PendingQuranInk[]>('pendingQuranInk')??[]).length)
    return {code:'INK_END_PENDING',status:409};
   // The fence and no-pending decision share one DO transaction, excluding
   // a concurrent ink write from slipping between check and D1 End.
   await txn.put('inkEndFence',{operationId:c.operationId,
    subject:c.actorSubject as string,completed:false});
   return {code:'INK_END_READY',status:200};
  });
  return Response.json({code:result.code},{status:result.status,
   headers:{'cache-control':'no-store'}});
 }
 async alarm():Promise<void>{
  const now=Date.now(),room=await this.ctx.storage.get<RoomRecord>('room');
  if(room){
   const shouldRemove:RoomRole[]=[];
   for(const role of ['teacher','learner'] as const){
    const lease=room[role];
    if(!lease)continue;
    if(lease.expiresAtMs<=now||
      (lease.mediaIntent&&!await this.authorized(lease,role,room.lessonId,now)))
     shouldRemove.push(role);
   }
   if(shouldRemove.length){
    await this.ctx.storage.transaction(async txn=>{
     const current=await txn.get<RoomRecord>('room');
     if(!current||current.lessonId!==room.lessonId)return;
     const pending=[...(await txn.get<PendingMediaEviction[]>('pendingEvictions')??[])];
     let next=current;
     for(const role of shouldRemove){
      const snapshot=room[role],latest=next[role];
      // Fence stale alarm observations against a renewed valid lease.
      if(!snapshot||!latest||snapshot.subject!==latest.subject||
         snapshot.learnerId!==latest.learnerId||
         snapshot.expiresAtMs!==latest.expiresAtMs)continue;
      enqueue(pending,next,role,latest);
      next={...next,[role]:null,revision:next.revision+1};
     }
     await txn.put('room',next);
     if(pending.length)await txn.put('pendingEvictions',pending);
    });
   }
  }
  await this.dispatch(now);
  await this.flushQuranInk();
  await this.scheduleNext(now);
 }
 async fetch(request:Request):Promise<Response>{
  const path=new URL(request.url).pathname;
  // Worker-only DO binding wake, called immediately after an authoritative
  // staff permission write. There is NO public Worker HTTP route for this URL.
  if(path==='/internal/reconcile-media'){
   if(request.method!=='POST')return Response.json({code:'NOT_FOUND'},{status:404});
   let input:unknown;
   try{input=await request.json();}catch{return Response.json({code:'NOT_FOUND'},{status:404});}
   if(!input||typeof input!=='object'||Array.isArray(input)||
      Object.keys(input).length!==1||
      !Object.hasOwn(input,'lessonId')||
      typeof (input as {lessonId:unknown}).lessonId!=='string'||
      !allowed.test((input as {lessonId:string}).lessonId))
    return Response.json({code:'NOT_FOUND'},{status:404});
   const lessonId=(input as {lessonId:string}).lessonId;
   const room=await this.ctx.storage.get<RoomRecord>('room');
   if(!room||room.lessonId!==lessonId)
    return Response.json({code:'ROOM_NOT_INITIALIZED'},{status:404});
   try{
    await this.alarm(); // D1 is rechecked, not the caller's supplied reason.
    return Response.json({code:'ROOM_RECONCILE_QUEUED'},
      {headers:{'cache-control':'no-store'}});
   }catch{return Response.json({code:'ROOM_RECONCILE_UNAVAILABLE'},{status:503});}
  }
  if(path==='/internal/ink-end-fence'){
   if(request.method!=='POST')return Response.json({code:'NOT_FOUND'},{status:404});
   let raw:unknown;
   try{raw=await request.json();}catch{return Response.json({code:'INVALID_INK_FENCE'},{status:400});}
   try{return await this.inkEndFence(raw);}
   catch{return Response.json({code:'INK_END_FENCE_UNAVAILABLE'},{status:503});}
  }
  if(path==='/internal/learner-microphone-policy'){
   if(request.method!=='POST')return Response.json({code:'NOT_FOUND'},{status:404});
   let raw:unknown;
   try{raw=await request.json();}catch{return Response.json({code:'INVALID_MIC_POLICY_COMMAND'},{status:400});}
   const cmd=parseVerifiedMicCommand(raw);
   if(!cmd)return Response.json({code:'INVALID_MIC_POLICY_COMMAND'},{status:400});
   const now=Date.now();
   try{
    return await this.ctx.storage.transaction(async txn=>{
     const room=await txn.get<RoomRecord>('room');
     if(!room||room.lessonId!==cmd.lessonId)
      return Response.json({code:'NOT_JOINED'},{status:404});
     const lease=room[cmd.role];
     if(!lease||lease.expiresAtMs<=now||lease.subject!==cmd.actorSubject||
      lease.learnerId!==cmd.learnerId)
      return Response.json({code:'NOT_JOINED'},{status:404});
     const current=await txn.get<MicPolicy>('learnerMicPolicy')??initialMicPolicy();
     if(cmd.action==='snapshot')
      return Response.json({code:'MIC_POLICY_SNAPSHOT',policy:current},
       {headers:{'cache-control':'no-store'}});
     // Only the current signed teacher can lock or release moderation. Releasing
     // never unmutes an audio track or starts capture on the learner's device.
     if(cmd.role!=='teacher')return Response.json({code:'NOT_JOINED'},{status:404});
     const next=applyMicPolicy(current,cmd.action);
     if(next!==current)await txn.put('learnerMicPolicy',next);
     return Response.json({code:cmd.action==='lock'?'MIC_POLICY_LOCKED':'MIC_POLICY_RELEASED',
      policy:next},{headers:{'cache-control':'no-store'}});
    });
   }catch{return Response.json({code:'MIC_POLICY_UNAVAILABLE'},{status:503});}
  }
  if(path==='/internal/corrections'){
   if(request.method!=='POST')return Response.json({code:'NOT_FOUND'},{status:404});
   let raw:unknown;
   try{raw=await request.json();}catch{return Response.json({code:'INVALID_CORRECTION_COMMAND'},{status:400});}
   const cmd=parseVerifiedCorrection(raw);
   if(!cmd)return Response.json({code:'INVALID_CORRECTION_COMMAND'},{status:400});
   const now=Date.now();
   try{
    return await this.ctx.storage.transaction(async txn=>{
     const state=await txn.get<CorrectionsState>('teacherCorrections')??initialCorrections();
     const view=(code:string,status=200)=>Response.json({
      code,corrections:{revision:state.revision,items:state.items}
     },{status,headers:{'cache-control':'no-store'}});
     const room=await txn.get<RoomRecord>('room');
     if(!room||room.lessonId!==cmd.lessonId)return Response.json({code:'NOT_JOINED'},{status:404});
     // Post-End report seed is a read-only Worker-to-DO operation, only after
     // fresh authenticated teacher authorization in D1. Historical author must
     // match the Sheikh who saved the original corrections.
     if(cmd.action==='seed'){
      if(state.teacherSubject&&state.teacherSubject!==cmd.actorSubject)
       return Response.json({code:'NOT_JOINED'},{status:404});
      return view('CORRECTIONS_SEED');
     }
     const lease=room.teacher;
     if(!lease||lease.subject!==cmd.actorSubject||
      lease.learnerId!==cmd.learnerId||lease.expiresAtMs<=now)
      return Response.json({code:'NOT_JOINED'},{status:404});
     if(cmd.action==='snapshot')return view('CORRECTIONS_SNAPSHOT');
     const page=await txn.get<SharedPageRecord>('quranPage')??initialPage();
     if(page.page!==cmd.page||(
       cmd.kind!=='general'&&(!page.verse||page.verse.surah!==cmd.surah||
        page.verse.ayah!==cmd.ayah)))
      return Response.json({code:'CORRECTION_CONFLICT'},{status:409});
     const applied=appendCorrection(state,cmd,now);
     if(applied.code==='CORRECTION_SAVED')
      await txn.put('teacherCorrections',applied.state);
     return Response.json({
      code:applied.code,
      corrections:{revision:applied.state.revision,items:applied.state.items}
     },{status:applied.code==='CORRECTION_CONFLICT'?409:
        applied.code==='CORRECTION_LIMIT'?413:200,
      headers:{'cache-control':'no-store'}});
    });
   }catch{return Response.json({code:'CLASSROOM_CORRECTIONS_UNAVAILABLE'},{status:503});}
  }
  if(path==='/internal/quran-ink'){
   if(request.method!=='POST')return Response.json({code:'NOT_FOUND'},{status:404});
   let raw:unknown;
   try{raw=await request.json();}catch{return Response.json({code:'INVALID_INK_COMMAND'},{status:400});}
   const cmd=parseInkCommand(raw);
   if(!cmd)return Response.json({code:'INVALID_INK_COMMAND'},{status:400});
   const now=Date.now();
   try{
    return await this.ctx.storage.transaction(async txn=>{
     const room=await txn.get<RoomRecord>('room');
     if(!room||room.lessonId!==cmd.lessonId)return Response.json({code:'NOT_JOINED'},{status:404});
     const lease=room[cmd.role];
     if(!lease||lease.expiresAtMs<=now||lease.subject!==cmd.actorSubject||
      lease.learnerId!==cmd.learnerId)return Response.json({code:'NOT_JOINED'},{status:404});
     const state=await txn.get<InkPage>('quranInk:'+cmd.page)??initialInk(cmd.page);
     if(cmd.action!=='snapshot'&&!this.env?.DB)
      return Response.json({code:'INK_D1_UNAVAILABLE'},{status:503});
     if(cmd.action!=='snapshot'&&!await this.liveInkLesson(cmd.lessonId,cmd.learnerId))
      return Response.json({code:'INK_LESSON_NOT_LIVE'},{status:409});
     if(cmd.action==='snapshot')return Response.json({code:'INK_SNAPSHOT',ink:visibleInk(state)},
      {headers:{'cache-control':'no-store'}});
     const current=await txn.get<SharedPageRecord>('quranPage')??initialPage();
     if(current.page!==cmd.page)return Response.json({code:'INK_CONFLICT',ink:visibleInk(state)},
      {status:409,headers:{'cache-control':'no-store'}});
     const fence=await txn.get<{completed:boolean}>('inkEndFence');
     if(fence)return Response.json({code:'INK_LESSON_ENDING'},{status:409});
     const result=applyInk(state,cmd);
     if(result.code==='INK_APPLIED'){
      const delivery=await prepareCumulativeInkDelivery(cmd,state,now);
      if(!delivery)return Response.json({code:'INK_DELIVERY_INVALID'},{status:503});
      const old=await txn.get<PendingQuranInk[]>('pendingQuranInk')??[];
      const queued=queueCumulativeInk(old,delivery);
      if(queued.code==='FULL'||queued.code==='CONFLICT')
       return Response.json({code:'INK_OUTBOX_'+queued.code},{status:503});
      if(!txn.setAlarm)
       return Response.json({code:'INK_ALARM_UNAVAILABLE'},{status:503});
      // SQLite-backed DO transaction commits page, outbox AND alarm together.
      await txn.put('quranInk:'+cmd.page,result.next);
      await txn.put('pendingQuranInk',[...queued.items]);
      await txn.setAlarm(now+RECONCILE_MS);
     }
     return Response.json({code:result.code,ink:visibleInk(result.next)},
      {status:result.code==='INK_CONFLICT'?409:result.code==='INK_LIMIT'?413:200,
       headers:{'cache-control':'no-store'}});
    }).then(async response=>{
     if(response.status!==200)return response;
     const body=await response.clone().json() as {code:string;ink?:unknown};
     if(body.code==='INK_APPLIED'||body.code==='INK_REPLAY'){
      await this.flushQuranInk();
      // Every queued event must reach D1 before responding with a saved ACK,
      // including an already accepted operation replayed after a lost reply.
      const remaining=await this.ctx.storage.get<PendingQuranInk[]>('pendingQuranInk')??[];
      if(remaining.length>0)return Response.json({code:'INK_SAVE_PENDING'},
       {status:503,headers:{'cache-control':'no-store'}});
      await this.scheduleNext(now);
     }
     return response;
    });
   }catch{return Response.json({code:'CLASSROOM_INK_UNAVAILABLE'},{status:503});}
  }
  if(path==='/internal/quran-page'){
   if(request.method!=='POST')return Response.json({code:'NOT_FOUND'},{status:404});
   let raw:unknown;
   try{raw=await request.json();}catch{return Response.json({code:'INVALID_QURAN_PAGE_COMMAND'},{status:400});}
   const cmd=parseVerifiedPageCommand(raw);
   if(!cmd)return Response.json({code:'INVALID_QURAN_PAGE_COMMAND'},{status:400});
   const now=Date.now();
   try{
    return await this.ctx.storage.transaction(async txn=>{
     const room=await txn.get<RoomRecord>('room');
     if(!room||room.lessonId!==cmd.lessonId)return Response.json({code:'NOT_JOINED'},{status:404});
     const lease=room[cmd.role];
     if(!lease||lease.expiresAtMs<=now||lease.subject!==cmd.actorSubject||
       lease.learnerId!==cmd.learnerId)
      return Response.json({code:'NOT_JOINED'},{status:404});
     const page=await txn.get<SharedPageRecord>('quranPage')??initialPage();
     if(cmd.action==='snapshot')
      return Response.json({code:'QURAN_PAGE_SNAPSHOT',quran:safePage(page)},
       {headers:{'cache-control':'no-store'}});
     const applied=applyPageSet(page,cmd);
     if(applied.code==='QURAN_PAGE_SET')await txn.put('quranPage',applied.next);
     return Response.json({code:applied.code,quran:safePage(applied.next)},{
      status:applied.code==='QURAN_PAGE_CONFLICT'?409:200,
      headers:{'cache-control':'no-store'}
     });
    });
   }catch{return Response.json({code:'CLASSROOM_QURAN_UNAVAILABLE'},{status:503});}
  }
  if(path!=='/internal/room-presence'||request.method!=='POST')
   return Response.json({code:'NOT_FOUND'},{status:404});
  let value:unknown;
  try{value=await request.json();}catch{return Response.json({code:'INVALID_ROOM_ACTION'},{status:400});}
  if(!validVerifiedRoomCommand(value))
   return Response.json({code:'INVALID_ROOM_ACTION'},{status:400});
  const command=value,now=Date.now();
  let result:RoomResult;
  try{
   result=await this.queued(now,command);
   await this.scheduleNext(now);
  }catch{return Response.json({code:'ROOM_EVICTION_UNAVAILABLE'},{status:503});}
  if(!result.ok)return Response.json({code:result.code},{
   status:result.code==='ROOM_ACTOR_CONFLICT'||result.code==='ROOM_EVICTION_PENDING'?409:404});
  // A confirmed leave enqueues a durable provider removal before replying.
  // Best effort immediate dispatch; alarm retries until provider acknowledges.
  if(command.action==='leave'){
   await this.dispatch(now);
   await this.scheduleNext(now);
  }
  return Response.json({code:result.code,presence:result.state},
   {headers:{'cache-control':'no-store'}});
 }
}
