import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {wakeActingTeacherMedia,wakeLessonMediaReconciliation} from '../src/classroom/media-enforcement.ts';
import {LessonRoom,type LessonRoomStorage} from '../src/classroom/lesson-room.ts';
import type {Env} from '../src/bindings.ts';

function storage(){
 const data=new Map<string,unknown>();
 const s:LessonRoomStorage={
  async get<T>(key:string){return data.get(key) as T|undefined;},
  async put<T>(key:string,value:T){data.set(key,value);},
  async transaction<T>(fn:(txn:Pick<LessonRoomStorage,'get'|'put'>)=>Promise<T>){return fn(s);},
  async setAlarm(time:number){void time;},
 };
 return s;
}
test('worker wakes only exact lesson DO; no arbitrary client role/provider parameters',async()=>{
 const bodies:Record<string,unknown>[]=[];
 const env:Env={LESSON_ROOMS:{
  idFromName(id){assert.equal(id,'authorized-lesson');return id;},
  get(){return {async fetch(request){
   assert.equal(new URL(request.url).pathname,'/internal/reconcile-media');
   assert.equal(request.method,'POST');
   bodies.push(await request.json() as Record<string,unknown>);
   return Response.json({code:'ROOM_RECONCILE_QUEUED'});
  }};}
 }};
 assert.equal(await wakeLessonMediaReconciliation(env,'authorized-lesson'),'sent');
 assert.deepEqual(bodies,[{lessonId:'authorized-lesson'}]);
 assert.equal(await wakeLessonMediaReconciliation(env,'../admin'),'unavailable');
 assert.equal(await wakeLessonMediaReconciliation({},'authorized-lesson'),'unavailable');
});
test('teacher post-write selects only bounded active lesson IDs from D1',async()=>{
 const ids:string[]=[];
 const env:Env={
  DB:{prepare(sql){
   assert.match(sql,/actual_teacher_id=\?/);
   assert.match(sql,/LIMIT 64/);
   return {bind(...args:unknown[]){
    assert.equal(args[0],'teacher-1');return this;},
    async all<T>(){return {results:[{id:'lesson-one'},{id:'lesson-two'}] as T[]};},
    async first<T>(){return null as T|null;},
    async run(){return {success:true,meta:{changes:0}};}
   };
  }},
  LESSON_ROOMS:{idFromName(id){ids.push(id);return id;},
   get(){return {async fetch(){return Response.json({code:'ROOM_RECONCILE_QUEUED'});}}}
  },
 };
 assert.equal(await wakeActingTeacherMedia(env,'teacher-1',1_700_000_000_000),'sent');
 assert.deepEqual(ids,['lesson-one','lesson-two']);
 assert.equal(await wakeActingTeacherMedia(env,'../bad'),'unavailable');
});
test('DO private reconcile rejects wrong lesson and invalid body, no fabricated presence',async()=>{
 const st=storage();const room=new LessonRoom({storage:st});
 const req=(body:unknown)=>room.fetch(new Request('https://lesson-room.internal/internal/reconcile-media',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),
 }));
 assert.equal((await req({lessonId:'room-a'})).status,404);
 assert.equal((await req({lessonId:'../other'})).status,404);
 const join=await room.fetch(new Request('https://lesson-room.internal/internal/room-presence',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({lessonId:'room-a',learnerId:'learner-a',
   actorSubject:'teacher-a',role:'teacher',action:'join'}),
 }));
 assert.equal(join.status,200);
 assert.equal((await req({lessonId:'room-b'})).status,404);
 assert.equal((await req({lessonId:'room-a',role:'teacher'})).status,404);
 const ok=await req({lessonId:'room-a'});
 assert.equal(ok.status,200);
 assert.equal((await ok.json()).code,'ROOM_RECONCILE_QUEUED');
 const state=await st.get<{revision:number}>('room');
 assert.equal(state?.revision,1,'reconcile should not invent a lifecycle event');
});
