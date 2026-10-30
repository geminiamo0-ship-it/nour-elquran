import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseVerifiedMicCommand,initialMicPolicy,applyMicPolicy,forwardVerifiedMicPolicy}
 from '../src/classroom/mic-policy.ts';
import {LessonRoom,type RoomRecord,type LessonRoomStorage} from '../src/classroom/lesson-room.ts';
import type {Env} from '../src/bindings.ts';

const teacher={lessonId:'lesson-mic',learnerId:'learner-mic',
 actorSubject:'teacher-subject',role:'teacher' as const};
const student={...teacher,actorSubject:'student-subject',role:'learner' as const};
function storage(){
 const items=new Map<string,unknown>();
 const api:LessonRoomStorage={
  async get<T>(key:string){return items.get(key) as T|undefined;},
  async put<T>(key:string,value:T){items.set(key,value);},
  async transaction<T>(fn:(s:Pick<LessonRoomStorage,'get'|'put'>)=>Promise<T>){return fn(api);},
 };
 return {api,items};
}
function request(room:LessonRoom,body:unknown){
 return room.fetch(new Request('https://internal.invalid/internal/learner-microphone-policy',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify(body),
 }));
}
test('only a signed teacher can lock or release mic moderation',()=>{
 assert.deepEqual(parseVerifiedMicCommand({...teacher,action:'release'}),
  {...teacher,action:'release'});
 assert.equal(parseVerifiedMicCommand({...student,action:'release'}),null);
 assert.equal(parseVerifiedMicCommand({...student,action:'lock'}),null);
 assert.equal(parseVerifiedMicCommand({...teacher,action:'remote-unmute'}),null);
 assert.equal(parseVerifiedMicCommand({...teacher,action:'release',trackSid:'other'}),null);
 assert.equal(parseVerifiedMicCommand({...teacher,action:'release',role:'learner'}),null);
 assert.equal(parseVerifiedMicCommand({...teacher,action:'release',lessonId:'?'}),null);
});
test('repeated lock/release is idempotent and versioned',()=>{
 const zero=initialMicPolicy();
 assert.deepEqual(zero,{locked:false,revision:0});
 const lock=applyMicPolicy(zero,'lock');
 assert.deepEqual(lock,{locked:true,revision:1});
 assert.equal(applyMicPolicy(lock,'lock'),lock);
 const release=applyMicPolicy(lock,'release');
 assert.deepEqual(release,{locked:false,revision:2});
 assert.equal(applyMicPolicy(release,'release'),release);
});
test('teacher release persists through DO restart and student can only read',async()=>{
 const {api,items}=storage(),now=Date.now();
 const members:RoomRecord={lessonId:'lesson-mic',revision:1,
  teacher:{subject:teacher.actorSubject,learnerId:'learner-mic',expiresAtMs:now+30_000},
  learner:{subject:student.actorSubject,learnerId:'learner-mic',expiresAtMs:now+30_000}};
 await api.put('room',members);
 let doRoom=new LessonRoom({storage:api});
 const initial=await request(doRoom,{...student,action:'snapshot'});
 assert.deepEqual((await initial.json()).policy,{locked:false,revision:0});
 assert.equal((await request(doRoom,{...student,action:'release'})).status,400);
 assert.equal((await request(doRoom,{...teacher,actorSubject:'forged',action:'lock'})).status,404);
 assert.equal((await request(doRoom,{...teacher,action:'lock'})).status,200);
 assert.deepEqual(items.get('learnerMicPolicy'),{locked:true,revision:1});
 doRoom=new LessonRoom({storage:api});
 const restored=await request(doRoom,{...student,action:'snapshot'});
 assert.deepEqual((await restored.json()).policy,{locked:true,revision:1});
 const release=await request(doRoom,{...teacher,action:'release'});
 assert.equal(release.status,200);
 assert.deepEqual((await release.json()).policy,{locked:false,revision:2});
 assert.equal((await request(doRoom,{...teacher,action:'release'})).status,200);
 assert.deepEqual(items.get('learnerMicPolicy'),{locked:false,revision:2});
 await api.put('room',{...members,teacher:{...members.teacher!,expiresAtMs:now-1000}});
 assert.equal((await request(doRoom,{...teacher,action:'lock'})).status,404);
 assert.deepEqual(items.get('learnerMicPolicy'),{locked:false,revision:2});
});
test('mic policy is fail-closed when DO binding is missing',async()=>{
 assert.deepEqual(await forwardVerifiedMicPolicy({} as Env,teacher,'release'),
  {status:503,code:'CLASSROOM_ROOM_NOT_CONFIGURED'});
});
