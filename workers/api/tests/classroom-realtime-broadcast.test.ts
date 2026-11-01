import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {LessonRoom,type LessonRoomContext,type RoomRecord,type LessonRoomStorage} from '../src/classroom/lesson-room.ts';
import type {Env} from '../src/bindings.ts';

const actor={lessonId:'lesson-realtime',learnerId:'learner-a',
 actorSubject:'signed-teacher',role:'teacher' as const};
function storage(room:RoomRecord):LessonRoomStorage{
 return {async get<T>(key:string){return (key==='room'?room:undefined) as T|undefined;},
  async put<T>(_key:string,_value:T){void _key;void _value;},
  async transaction<T>(fn:(s:Pick<LessonRoomStorage,'get'|'put'>)=>Promise<T>){
   return fn(this);
  }};
}
function environment(allowed:boolean):Env{
 const now=Date.now();
 return {NOOR_REALTIME_HINTS_ENABLED:'true',DB:{prepare:(_sql:string)=>{void _sql;return {
  bind:()=>({first:async()=>allowed?{
   id:actor.lessonId,learnerId:actor.learnerId,role:'teacher',
   kind:'standard',status:'live',startsAtMs:now-10000,endsAtMs:now+10000
  }:null})
 };}}} as unknown as Env;
}
type SocketDouble={
 readyState:number;deserializeAttachment:()=>unknown;send:(x:string)=>void;
 close:(code:number,reason:string)=>void;
};
function harness(options:{permit?:boolean;expires?:boolean;wrongActor?:boolean}={}){
 const now=Date.now(),sent:string[]=[],closed:number[]=[];
 const room:RoomRecord={lessonId:actor.lessonId,revision:2,
  teacher:{subject:actor.actorSubject,learnerId:actor.learnerId,
   expiresAtMs:now+(options.expires?-10000:10000)},
  learner:null};
 const socket:SocketDouble={readyState:1,
  deserializeAttachment:()=>options.wrongActor?{...actor,learnerId:'other-learner'}:actor,
  send:(payload:string)=>{sent.push(payload);},
  close:(code:number)=>{closed.push(code);}};
 const ctx:LessonRoomContext={storage:storage(room),
  getWebSockets:()=>[socket as unknown as WebSocket]};
 const instance=new LessonRoom(ctx,environment(options.permit!==false));
 return {instance,sent,closed};
}
async function broadcast(h:ReturnType<typeof harness>,payload:unknown,onlyRole?:'teacher'|'learner'){
 // Exercise the isolated DO hibernating-socket broadcast validator directly.
 const instance=h.instance as unknown as {pushRealtime:(hint:unknown,role?:'teacher'|'learner')=>Promise<void>};
 await instance.pushRealtime(payload,onlyRole);
}
test('authorized signed in-room viewer gets only committed bounded revision hint',async()=>{
 const h=harness();
 await broadcast(h,{type:'quran-page',page:35,revision:7});
 assert.equal(h.sent.length,1);
 assert.deepEqual(JSON.parse(h.sent[0]!),{type:'quran-page',page:35,revision:7});
 assert.deepEqual(h.closed,[]);
});
test('revoked D1 grant closes socket, emits nothing',async()=>{
 const h=harness({permit:false});
 await broadcast(h,{type:'quran-ink',page:35,revision:1});
 assert.deepEqual(h.sent,[]);
 assert.deepEqual(h.closed,[1008]);
});
test('expired lease or cross-learner actor cannot observe page events',async()=>{
 for(const options of [{expires:true},{wrongActor:true}]){
  const h=harness(options);
  await broadcast(h,{type:'quran-page',page:35,revision:1});
  assert.deepEqual(h.sent,[]);
  assert.deepEqual(h.closed,[1008]);
 }
});
test('no optimistic uncommitted ink data or saved receipt crosses socket',async()=>{
 const h=harness();
 for(const payload of [
  {type:'quran-ink',page:35,revision:1,persistence:'saved'},
  {type:'quran-ink',page:35,revision:1,strokes:[]},
  {type:'quran-ink',page:35,revision:1,actorSubject:'forged'},
 ])await broadcast(h,payload);
 assert.deepEqual(h.sent,[]);
 assert.deepEqual(h.closed,[]);
});

test('teacher-private corrections revision is not broadcast to learner sockets',async()=>{
 const h=harness();
 await broadcast(h,{type:'corrections',page:35,revision:2},'learner');
 assert.deepEqual(h.sent,[]);
 await broadcast(h,{type:'corrections',page:35,revision:2},'teacher');
 assert.deepEqual(JSON.parse(h.sent[0]!),{type:'corrections',page:35,revision:2});
});
