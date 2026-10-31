import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseLifecycleAction,readTeacherLifecycle,readLearnerLifecycle,
 teacherLifecycleAction} from '../src/classroom/lesson-lifecycle-write.ts';
import type {CoreDatabase,Env,D1Statement} from '../src/bindings.ts';

const lessonId='lesson-lifecycle',studentId='learner-lifecycle',teacherSubject='signed-sheikh';
const requestId='0996d89e-1e5b-4d33-9abe-79f255f553eb';
const starts=1_900_000_000_000,now=starts+10_000;
test('accept only explicit teacher command with strict V4 operation ID',()=>{
 assert.deepEqual(parseLifecycleAction({action:'start',operationId:requestId}),
  {action:'start',operationId:requestId});
 for(const value of [{action:'end',operationId:'x'},{action:'automatic',operationId:requestId},
  {action:'start',operationId:requestId,role:'teacher'},
  {action:'start',operationId:requestId,teacherId:'forged'},null,[],{}])
  assert.equal(parseLifecycleAction(value),null);
});
function harness(config:{both?:boolean;authorized?:boolean;noBatch?:boolean;owner?:boolean;inkPending?:boolean}={}){
 let status:'scheduled'|'live'|'completed'='scheduled',endedAtMs:null|number=null;
 let startedAtMs:null|number=null,events=0;
 const statements:string[]=[];
 const row=()=>({id:lessonId,learnerId:studentId,teacherId:'teacher-a',
  status,startsAtMs:starts,endsAtMs:starts+40*60_000,endedAtMs});
 const db:CoreDatabase={
  prepare(sql:string):D1Statement{
   statements.push(sql);
   const stmt:D1Statement={
    bind(...values:unknown[]){void values;return this;},
    async first<T>(){
     if(sql.includes('JOIN teachers t'))return (config.authorized===false?null:row()) as T;
     if(sql.includes('owner.auth_subject=?'))return (config.owner===false?null:row()) as T;
     return null;
    },
    async all<T>(){
     if(sql.includes('lesson_lifecycle_events'))
      return {results:(startedAtMs===null?[]:[{action:'start',at_ms:startedAtMs}]) as T[]};
     return {results:[] as T[]};
    },
    async run(){return {success:true,meta:{changes:0}};}
   };return stmt;
  },
  ...(!config.noBatch?{async batch(items:D1Statement[]){
   assert.equal(items.length,2);
   events++;
   if(status==='scheduled'){status='live';startedAtMs=now;}
   else if(status==='live'){status='completed';endedAtMs=now+20_000;}
   return [{success:true,meta:{changes:1}},{success:true,meta:{changes:1}}];
  }}:{}),
 };
 const calls:string[]=[];
 const env:Env={DB:db,LESSON_ROOMS:{
  idFromName(x){return x;},
  get(){return {async fetch(req){
   const path=new URL(req.url).pathname;calls.push(path);
   if(path==='/internal/room-presence')return Response.json({
    code:'ROOM_SNAPSHOT',presence:{lessonId,teacherPresent:true,
     learnerPresent:config.both!==false,bothPresent:config.both!==false,
     revision:2,leaseTtlMs:25000,mediaReady:false,canStart:false}});
   return Response.json({code:'ROOM_RECONCILE_QUEUED'});
  }};}
 }};
 return {env,events:()=>events,statements,calls};
}
test('refuse Start when learner is missing; do not mutate D1',async()=>{
 const h=harness({both:false});
 const result=await teacherLifecycleAction(h.env,teacherSubject,lessonId,'start',requestId,now);
 assert.deepEqual(result,{status:409,code:'WAITING_FOR_PARTICIPANTS'});
 assert.equal(h.events(),0);
});
test('one signed Sheikh Start and explicit End are audited, with server-triggered media wake',async()=>{
 const h=harness();
 const first=await teacherLifecycleAction(h.env,teacherSubject,lessonId,'start',requestId,now);
 assert.equal(first.code,'LESSON_STARTED');assert.equal(first.lifecycle?.phase,'live');
 assert.equal(first.lifecycle?.startedAtMs,now);
 assert.equal(h.events(),1);
 assert.ok(h.statements.some(sql=>sql.includes('changes()=1')));
 const replay=await teacherLifecycleAction(h.env,teacherSubject,lessonId,'start',requestId,now);
 assert.equal(replay.code,'LESSON_ALREADY_STARTED');assert.equal(h.events(),1);
 const end=await teacherLifecycleAction(h.env,teacherSubject,lessonId,'end',
  '2163d489-5a27-4af2-83d0-1c3b7f989eff',now+20_000);
 assert.equal(end.code,'LESSON_ENDED');
 assert.equal(end.lifecycle?.phase,'completed');
 assert.equal(end.mediaRevocation,'requested');
 assert.ok(h.calls.includes('/internal/reconcile-media'));
 const ended=await teacherLifecycleAction(h.env,teacherSubject,lessonId,'end',
  '2163d489-5a27-4af2-83d0-1c3b7f989eff',now+30_000);
 assert.equal(ended.code,'LESSON_ALREADY_ENDED');assert.equal(h.events(),2);
 const learner=await readLearnerLifecycle(h.env,'signed-owner',studentId,lessonId);
 assert.equal(learner.status,200);
 if(learner.status===200)assert.equal(learner.lifecycle.phase,'completed');
});
test('unauthorized Sheikh/owner cannot see lesson and atomic D1 is mandatory',async()=>{
 const blocked=harness({authorized:false});
 assert.equal((await readTeacherLifecycle(blocked.env,teacherSubject,lessonId,now)).status,404);
 assert.equal((await teacherLifecycleAction(blocked.env,teacherSubject,lessonId,
   'start',requestId,now)).status,404);
 const badOwner=harness({owner:false});
 assert.equal((await readLearnerLifecycle(badOwner.env,'another',studentId,lessonId)).status,404);
 const noBatch=harness({noBatch:true});
 assert.deepEqual(await teacherLifecycleAction(noBatch.env,teacherSubject,lessonId,
  'start',requestId,now),{status:503,code:'ATOMIC_D1_BATCH_REQUIRED'});
 assert.equal(noBatch.events(),0);
});

test('ink queue is a hard End barrier: no D1 End audit until canonical ACK',async()=>{
 const h=harness({inkPending:true});
 assert.equal((await teacherLifecycleAction(h.env,teacherSubject,lessonId,'start',
  requestId,now)).code,'LESSON_STARTED');
 const ended=await teacherLifecycleAction(h.env,teacherSubject,lessonId,'end',
  '2163d489-5a27-4af2-83d0-1c3b7f989eff',now+20_000);
 assert.deepEqual(ended,{status:409,code:'INK_END_PENDING'});
 assert.equal(h.events(),1);
});
