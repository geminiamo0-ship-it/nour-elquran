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
import {appendQuranLedgerEvent} from '../learner-quran-ledger.ts';
import {prepareCumulativeInkDelivery,queueCumulativeInk,
 type PendingQuranInk} from './ink-cumulative-outbox.ts';
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
 transaction<T>(fn:(txn:Pick<LessonRoomStorage,'get'|'put'>)=>Promise<T>):Promise<T>;
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
 constructor(ctx:LessonRoomContext,env?:Env){this.ctx=ctx;this.env=env;}
 private get cumulativeInkEnabled(){return this.env?.NOOR_CUMULATIVE_INK_ENABLED==='true';}
 private async scheduleNext(now:number):Promise<void>{
  if(!this.ctx.storage.setAlarm)return;
  const [room,outbox,pendingInk]=await Promise.all([
   this.ctx.storage.get<RoomRecord>('room'),
   this.ctx.storage.get<PendingMediaEviction[]>('pendingEvictions'),
   this.cumulativeInkEnabled?this.ctx.storage.get<PendingQuranInk[]>('pendingQuranInk'):Promise.resolve(undefined)
  ]);
  if((pendingInk?.length??0)>0||(outbox?.length??0)>0||room?.teacher?.mediaIntent||room?.learner?.mediaIntent)
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
 /** FIFO durable reconciliation. Removing the pending event happens only AFTER
  * a confirmed D1 commit/replay. Errors or role-revocation uncertainty retain
  * all remaining records, not a false success or destructive retry. */
 private async flushQuranInk():Promise<number>{
  if(!this.cumulativeInkEnabled)return 0;
  const pending=await this.ctx.storage.get<PendingQuranInk[]>('pendingQuranInk')??[];
  if(!this.env?.DB)return pending.length;
  for(const item of pending){
   try{
    const result=await appendQuranLedgerEvent(this.env.DB,
     {subject:item.actorSubject,role:item.actorRole},item.learnerId,
     item.command,item.acceptedAtMs);
    if(result.code!=='QURAN_EVENT_COMMITTED'&&result.code!=='QURAN_EVENT_REPLAY')break;
    await this.ctx.storage.transaction(async txn=>{
     const current=await txn.get<PendingQuranInk[]>('pendingQuranInk')??[];
     if(current[0]?.operationId!==item.operationId)
      throw Error('QURAN_INK_OUTBOX_REORDERED');
     await txn.put('pendingQuranInk',current.slice(1));
    });
   }catch{break;}
  }
  return (await this.ctx.storage.get<PendingQuranInk[]>('pendingQuranInk')??[]).length;
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
  // The authenticated Worker fences the room BEFORE D1 lesson End. Room
  // transactions serialize this fence with ink additions; a pending D1 row
  // prevents End and the alarm can safely retry while lesson remains live.
  if(path==='/internal/quran-ink-end-fence'){
   if(request.method!=='POST'||!this.cumulativeInkEnabled)
    return Response.json({code:'NOT_FOUND'},{status:404});
   let value:unknown;
   try{value=await request.json();}catch{return Response.json({code:'INVALID_INK_FENCE'},{status:400});}
   if(!value||typeof value!=='object'||Array.isArray(value))
    return Response.json({code:'INVALID_INK_FENCE'},{status:400});
   const input=value as Record<string,unknown>;
   if(Object.keys(input).length!==3||
    typeof input.lessonId!=='string'||!allowed.test(input.lessonId)||
    typeof input.learnerId!=='string'||!allowed.test(input.learnerId)||
    typeof input.actorSubject!=='string'||!allowed.test(input.actorSubject))
    return Response.json({code:'INVALID_INK_FENCE'},{status:400});
   try{
    await this.flushQuranInk();
    return await this.ctx.storage.transaction(async txn=>{
     const room=await txn.get<RoomRecord>('room');
     if(!room||room.lessonId!==input.lessonId||
      room.teacher?.subject!==input.actorSubject||
      room.teacher.learnerId!==input.learnerId)
      return Response.json({code:'NOT_JOINED'},{status:404});
     const pending=await txn.get<PendingQuranInk[]>('pendingQuranInk')??[];
     if(pending.length)
      return Response.json({code:'QURAN_INK_PENDING',pending:pending.length},{status:409});
     await txn.put('quranInkClosing',true);
     return Response.json({code:'QURAN_INK_FENCED'});
    });
   }catch{return Response.json({code:'QURAN_INK_FENCE_UNAVAILABLE'},{status:503});}
  }
  if(path==='/internal/quran-ink'){
   if(request.method!=='POST')return Response.json({code:'NOT_FOUND'},{status:404});
   let raw:unknown;
   try{raw=await request.json();}catch{return Response.json({code:'INVALID_INK_COMMAND'},{status:400});}
   const cmd=parseInkCommand(raw);
   if(!cmd)return Response.json({code:'INVALID_INK_COMMAND'},{status:400});
   const now=Date.now(),durable=this.cumulativeInkEnabled;
   // Gate cannot be opened on a room without D1. Preflight *fresh* grant,
   // live lesson state and current media authority; browser role is ignored.
   if(durable&&cmd.action!=='snapshot'){
    if(!this.env?.DB)return Response.json({code:'QURAN_D1_UNAVAILABLE'},{status:503});
    const valid=await this.authorized({subject:cmd.actorSubject,learnerId:cmd.learnerId,
     expiresAtMs:now+1},cmd.role,cmd.lessonId,now);
    if(!valid)return Response.json({code:'INK_PERMISSION_NOT_VERIFIED'},{status:503});
    try{
     const lesson=await this.env.DB.prepare(
      "SELECT status FROM lessons WHERE id=? AND learner_id=?"
     ).bind(cmd.lessonId,cmd.learnerId).first<{status:string}>();
     if(lesson?.status!=='live')
      return Response.json({code:'LESSON_NOT_LIVE'},{status:409});
    }catch{return Response.json({code:'QURAN_D1_UNAVAILABLE'},{status:503});}
   }
   try{
    const applied=await this.ctx.storage.transaction(async txn=>{
     const room=await txn.get<RoomRecord>('room');
     if(!room||room.lessonId!==cmd.lessonId)return {code:'NOT_JOINED',status:404} as const;
     const lease=room[cmd.role];
     if(!lease||lease.expiresAtMs<=now||lease.subject!==cmd.actorSubject||
      lease.learnerId!==cmd.learnerId)return {code:'NOT_JOINED',status:404} as const;
     const state=await txn.get<InkPage>('quranInk:'+cmd.page)??initialInk(cmd.page);
     if(durable&&cmd.action!=='snapshot'&&await txn.get<boolean>('quranInkClosing'))
      return {code:'LESSON_INK_CLOSING',status:409} as const;
     if(cmd.action==='snapshot'){
      const pending=durable?(await txn.get<PendingQuranInk[]>('pendingQuranInk')??[]):[];
      return {code:'INK_SNAPSHOT',status:200,ink:visibleInk(state),
       persistence:pending.length?'pending' as const:'saved' as const} as const;
     }
     const current=await txn.get<SharedPageRecord>('quranPage')??initialPage();
     if(current.page!==cmd.page)
      return {code:'INK_CONFLICT',status:409,ink:visibleInk(state)} as const;
     const result=applyInk(state,cmd);
     if(result.code==='INK_APPLIED'){
      if(durable){
       const event=await prepareCumulativeInkDelivery(cmd,state,now);
       if(!event)return {code:'INK_DELIVERY_INVALID',status:503} as const;
       const existing=await txn.get<PendingQuranInk[]>('pendingQuranInk')??[];
       const queued=queueCumulativeInk(existing,event);
       if(queued.code!=='QUEUED'&&queued.code!=='REPLAY')
        return {code:'INK_DELIVERY_'+queued.code,status:queued.code==='FULL'?413:409} as const;
       // DO transaction persists the stroke AND the recovery record atomically.
       await txn.put('pendingQuranInk',[...queued.items]);
      }
      await txn.put('quranInk:'+cmd.page,result.next);
     }
     return {code:result.code,status:result.code==='INK_CONFLICT'?409:
      result.code==='INK_LIMIT'?413:200,ink:visibleInk(result.next)} as const;
    });
    if(!('ink' in applied)||!applied.ink)
     return Response.json({code:applied.code},{status:applied.status});
    if(!durable||cmd.action==='snapshot'||applied.status!==200)
     return Response.json({code:applied.code,ink:applied.ink,
      ...('persistence' in applied?{persistence:applied.persistence}:{})},
      {status:applied.status,headers:{'cache-control':'no-store'}});
    // Retained room-local stroke does NOT count as globally saved.
    // Attempt immediate D1 reconciliation, then report whether pending remains.
    const remaining=await this.flushQuranInk();
    await this.scheduleNext(now);
    return Response.json({code:remaining?'INK_PENDING_PERSISTENCE':applied.code,
     persistence:remaining?'pending':'saved',ink:applied.ink},
     {status:remaining?202:200,headers:{'cache-control':'no-store'}});
   }catch{
    // In the failure case an outbox row may already exist; alarm will replay.
    // Never turn this into a fake commit response.
    try{await this.scheduleNext(now);}catch{ /* still no global saved ack */ }
    return Response.json({code:'CLASSROOM_INK_UNAVAILABLE'},{status:503});
   }
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
