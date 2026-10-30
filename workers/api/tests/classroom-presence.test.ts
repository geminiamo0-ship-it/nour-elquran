import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {ROOM_LEASE_MS,applyRoomCommand,roomSnapshot,LessonRoom,
 type VerifiedRoomCommand,type RoomRecord} from '../src/classroom/lesson-room.ts';
import {parseClientPresenceAction,forwardVerifiedPresence} from '../src/classroom/presence.ts';
import type {Env} from '../src/bindings.ts';

const teacher:VerifiedRoomCommand={
 lessonId:'lesson-1',learnerId:'learner-a',role:'teacher',
 actorSubject:'verified-sheikh',action:'join',
};
const learner:VerifiedRoomCommand={
 ...teacher,role:'learner',actorSubject:'verified-account',
};
test('public body permits only explicit join/heartbeat/leave, never claimed roles or identity',()=>{
 assert.equal(parseClientPresenceAction({action:'join'}),'join');
 assert.equal(parseClientPresenceAction({action:'heartbeat'}),'heartbeat');
 assert.equal(parseClientPresenceAction({action:'leave'}),'leave');
 for(const v of [{action:'snapshot'},{action:'join',role:'teacher'},
  {action:'join',actorSubject:'forged'},{action:'join',learnerId:'other'},
  {action:'join',lessonId:'other'},{action:'join',isAdmin:true},
  {action:'start'},null,[],{},'join'])
  assert.equal(parseClientPresenceAction(v),null);
});
test('two independently signed participants required and neither is a lesson Start',()=>{
 const one=applyRoomCommand(null,teacher,1000);
 assert.equal(one.result.ok,true);
 assert.deepEqual(roomSnapshot(one.next!,1000),{
  lessonId:'lesson-1',teacherPresent:true,learnerPresent:false,
  bothPresent:false,revision:1,leaseTtlMs:ROOM_LEASE_MS,mediaReady:false,canStart:false,
 });
 const both=applyRoomCommand(one.next,learner,1100);
 assert.equal(both.result.ok,true);
 const active=roomSnapshot(both.next!,1100);
 assert.equal(active.bothPresent,true);
 assert.equal(active.canStart,false);
 assert.equal(active.mediaReady,false);
 assert.equal(roomSnapshot(both.next!,1000+ROOM_LEASE_MS).teacherPresent,false);
 assert.equal(roomSnapshot(both.next!,1100+ROOM_LEASE_MS).bothPresent,false);
});
test('heartbeats do not JOIN; lease expires and revoked old token cannot count presence forever',()=>{
 const deny=applyRoomCommand(null,{...teacher,action:'heartbeat'},1000);
 assert.deepEqual(deny.result,{ok:false,code:'NOT_JOINED'});
 const one=applyRoomCommand(null,teacher,1000);
 assert.deepEqual(applyRoomCommand(one.next,{...teacher,actorSubject:'forged',action:'heartbeat'},1500).result,
  {ok:false,code:'NOT_JOINED'});
 const refresh=applyRoomCommand(one.next,{...teacher,action:'heartbeat'},5000);
 assert.equal(refresh.result.ok,true);
 assert.equal(roomSnapshot(refresh.next!,ROOM_LEASE_MS+2000).teacherPresent,true);
 assert.equal(roomSnapshot(refresh.next!,ROOM_LEASE_MS+5000).teacherPresent,false);
 assert.deepEqual(applyRoomCommand(refresh.next,{...teacher,action:'heartbeat'},ROOM_LEASE_MS+5001).result,
  {ok:false,code:'NOT_JOINED'});
 const rejoin=applyRoomCommand(refresh.next,teacher,ROOM_LEASE_MS+5001);
 assert.equal(rejoin.result.ok,true);
});
test('room prevents two different principals occupying same role during valid lease',()=>{
 const one=applyRoomCommand(null,learner,1000);
 const collision=applyRoomCommand(one.next,{...learner,actorSubject:'other-account'},1100);
 assert.deepEqual(collision.result,{ok:false,code:'ROOM_ACTOR_CONFLICT'});
 assert.equal(collision.next,one.next);
 const gone=applyRoomCommand(one.next,{...learner,action:'leave'},1200);
 assert.equal(gone.result.ok,true);
 assert.equal(roomSnapshot(gone.next!,1200).learnerPresent,false);
 assert.equal(applyRoomCommand(gone.next,{...learner,action:'leave'},1201).result.ok,false);
});
test('wrong lesson id does not mutate another room and snapshots are nonmutating',()=>{
 const one=applyRoomCommand(null,teacher,1000);
 assert.deepEqual(applyRoomCommand(one.next,{...learner,lessonId:'other'},1100).result,
  {ok:false,code:'ROOM_ID_MISMATCH'});
 assert.equal(applyRoomCommand(one.next,{...teacher,action:'snapshot'},1100).next,one.next);
});
test('Room persists leases and never fabricates connected participants after restart',async()=>{
 const store=new Map<string,RoomRecord>();let writes=0;
 const storage={
  async get<T>(name:string){return store.get(name) as T|undefined;},
  async put<T>(name:string,value:T){writes++;store.set(name,value as RoomRecord);},
  async transaction<T>(fn:(tx:any)=>Promise<T>){return fn(storage);},
 };
 const room=new LessonRoom({storage});
 const req=(payload:unknown)=>new Request('https://do.invalid/internal/room-presence',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),
 });
 const first=await room.fetch(req(teacher));
 assert.equal(first.status,200);
 assert.equal(writes,1);
 const reboot=new LessonRoom({storage});
 const next=await reboot.fetch(req({...teacher,action:'snapshot'}));
 assert.equal(next.status,200);
 assert.equal(writes,1);
 assert.equal((await next.json()).presence.teacherPresent,true);
 assert.equal((await reboot.fetch(req({...teacher,role:'admin'}))).status,400);
 assert.equal((await reboot.fetch(new Request('https://do.invalid/anything'))).status,404);
});
test('forwarder fails closed without binding, on corrupt state, and NEVER accepts start',async()=>{
 const env={} as Env;
 const verified={lessonId:'lesson-1',learnerId:'learner-a',
  actorSubject:'verified-sheikh',role:'teacher' as const};
 assert.deepEqual(await forwardVerifiedPresence(env,verified,'join'),
  {status:503,code:'CLASSROOM_ROOM_NOT_CONFIGURED'});
 const broken={LESSON_ROOMS:{idFromName:()=>({}),get:()=>({fetch:async()=>{
  return Response.json({code:'ROOM_JOINED',presence:{lessonId:'fake',bothPresent:true}});
 }})}} as unknown as Env;
 assert.deepEqual(await forwardVerifiedPresence(broken,verified,'join'),
  {status:503,code:'CLASSROOM_ROOM_UNAVAILABLE'});
});
