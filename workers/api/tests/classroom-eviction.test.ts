import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {LessonRoom,ROOM_LEASE_MS,
 type LessonRoomStorage,type RoomRecord,type PendingMediaEviction} from '../src/classroom/lesson-room.ts';
import type {CoreDatabase,Env} from '../src/bindings.ts';

const secrets={LIVEKIT_URL:'wss://nq-example.livekit.cloud',
 LIVEKIT_API_KEY:'FAKEKEY1234567',
 LIVEKIT_API_SECRET:'only-synthetic-32plus-byte-provider-secret-never-deploy'};
const lessonId='synthetic-lesson-1',learnerId='synthetic-learner-1';
const owner='synthetic-household',sheikh='synthetic-teacher';
type Role='teacher'|'learner';
function command(role:Role,action:string){
 return {lessonId,learnerId,actorSubject:role==='teacher'?sheikh:owner,role,action};
}
class Storage implements LessonRoomStorage{
 readonly values=new Map<string,unknown>();
 alarmAt:number|null=null;
 async get<T>(name:string){return this.values.get(name) as T|undefined;}
 async put<T>(name:string,value:T){this.values.set(name,value);}
 async transaction<T>(fn:(txn:Pick<LessonRoomStorage,'get'|'put'>)=>Promise<T>){
  return fn(this);
 }
 async setAlarm(time:number){this.alarmAt=time;}
}
function fakeDB(teacherAllowed=true):CoreDatabase{
 return {prepare(sql){
  let values:unknown[]=[];
  return {
   bind(...args:unknown[]){values=args;return this;},
   async first<T>(){
    // The alarm reads role scope using the same qualified teacher SQL as
    // signed token minting, never a role from a browser.
    if(sql.includes('JOIN teachers t')){
     if(!teacherAllowed||values[0]!==lessonId||values[1]!==sheikh)return null;
     return {id:lessonId,learnerId,status:'live',kind:'standard',
      startsAtMs:0,endsAtMs:4_000_000_000_000,role:'teacher'} as T;
    }
    if(sql.includes('SELECT id FROM accounts')){
     return values[0]===owner?{id:'household-id'} as T:null;
    }
    if(sql.includes('JOIN learners learner')){
     if(values[0]!==lessonId||values[1]!==learnerId)return null;
     return {id:lessonId,learnerId,status:'live',kind:'standard',
      startsAtMs:0,endsAtMs:4_000_000_000_000,role:'learner'} as T;
    }
    return null;
   },
   async all<T>(){return {results:[] as T[]};},
   async run(){return {success:true,meta:{changes:0}};}
  };
 }};
}
async function action(room:LessonRoom,role:Role,kind:string){
 return room.fetch(new Request('https://lesson-room.internal/internal/room-presence',
  {method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify(command(role,kind))}));
}
function testRoom(storage:Storage,db:CoreDatabase):LessonRoom{
 return new LessonRoom({storage},{...secrets,DB:db} as Env);
}
test('media-intent activates durable alarm; no-client media intent without join',async()=>{
 const storage=new Storage(),room=testRoom(storage,fakeDB());
 assert.equal((await action(room,'teacher','media-intent')).status,404);
 assert.equal((await action(room,'teacher','join')).status,200);
 assert.equal(storage.alarmAt,null);
 const result=await action(room,'teacher','media-intent');
 assert.equal(result.status,200);
 assert.equal((await result.json()).code,'ROOM_MEDIA_INTENT');
 assert.ok(storage.alarmAt!==null);
 assert.equal((await storage.get<RoomRecord>('room'))?.teacher?.mediaIntent,true);
 assert.equal((await action(room,'teacher','heartbeat')).status,200);
 assert.equal((await storage.get<RoomRecord>('room'))?.teacher?.mediaIntent,true);
});
test('provider outage leaves durable eviction pending across DO reconstruction; blocks rejoin',async()=>{
 const savedFetch=globalThis.fetch,savedNow=Date.now;
 let providerCalls=0,providerOk=false;
 globalThis.fetch=(async()=>{providerCalls++;return new Response('{}',
  {status:providerOk?200:503,headers:{'content-type':'application/json'}});}) as typeof fetch;
 const clock=1_800_000_000_000;
 Date.now=()=>clock;
 try{
  const storage=new Storage(),room=testRoom(storage,fakeDB());
  assert.equal((await action(room,'teacher','join')).status,200);
  assert.equal((await action(room,'teacher','media-intent')).status,200);
  const left=await action(room,'teacher','leave');
  assert.equal(left.status,200);
  assert.equal((await storage.get<PendingMediaEviction[]>('pendingEvictions'))?.length,1);
  assert.ok(providerCalls>0);
  assert.equal((await action(room,'teacher','join')).status,409,
   'cannot rejoin while old token ejection is still unacknowledged');
  const restarted=testRoom(storage,fakeDB());
  await restarted.alarm(); // provider still down, no lost outbox
  assert.equal((await storage.get<PendingMediaEviction[]>('pendingEvictions'))?.length,1);
  providerOk=true;
  await restarted.alarm();
  assert.deepEqual(await storage.get<PendingMediaEviction[]>('pendingEvictions'),[]);
  assert.equal((await action(restarted,'teacher','join')).status,200);
 }finally{globalThis.fetch=savedFetch;Date.now=savedNow;}
});
test('10s alarm observes revoked teacher permission and enqueues correct role only',async()=>{
 const savedFetch=globalThis.fetch,savedNow=Date.now;
 const calls:Record<string,unknown>[]=[];
 globalThis.fetch=(async(_input,init)=>{
  calls.push(JSON.parse(String(init?.body)) as Record<string,unknown>);
  return Response.json({});
 }) as typeof fetch;
 const now=1_800_000_000_000;
 Date.now=()=>now;
 try{
  const store=new Storage();
  const room=testRoom(store,fakeDB(true));
  await action(room,'teacher','join');
  await action(room,'teacher','media-intent');
  await action(room,'learner','join');
  await action(room,'learner','media-intent');
  const revokedRoom=testRoom(store,fakeDB(false));
  await revokedRoom.alarm();
  const persisted=await store.get<RoomRecord>('room');
  assert.equal(persisted?.teacher,null);
  assert.equal(persisted?.learner?.subject,owner);
  assert.equal(calls.length,1);
  assert.equal(typeof calls[0]?.identity,'string');
  assert.ok(String(calls[0]?.identity).startsWith('nq-'));
  assert.equal((await action(revokedRoom,'learner','heartbeat')).status,200);
 }finally{globalThis.fetch=savedFetch;Date.now=savedNow;}
});
test('expired media lease is server-evicted after DO alarm independent of browser cooperation',async()=>{
 const savedFetch=globalThis.fetch,savedNow=Date.now;
 let removed=0;const origin=1_800_000_000_000;
 globalThis.fetch=(async()=>{removed++;return Response.json({});}) as typeof fetch;
 let now=origin;Date.now=()=>now;
 try{
  const storage=new Storage(),room=testRoom(storage,fakeDB());
  await action(room,'learner','join');
  await action(room,'learner','media-intent');
  now+=ROOM_LEASE_MS+1;
  await room.alarm();
  assert.equal(removed,1);
  assert.equal((await storage.get<RoomRecord>('room'))?.learner,null);
  assert.deepEqual(await storage.get<PendingMediaEviction[]>('pendingEvictions'),[]);
  assert.equal((await action(room,'learner','heartbeat')).status,404);
 }finally{globalThis.fetch=savedFetch;Date.now=savedNow;}
});
