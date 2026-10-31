import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {LessonRoom,type RoomRecord,type LessonRoomContext,type LessonRoomStorage}
 from '../src/classroom/lesson-room.ts';
import type {Env} from '../src/bindings.ts';
const now=Date.now();
const lessonId='test-preview-lesson',learnerId='test-preview-learner';
const teacher={lessonId,learnerId,actorSubject:'signed-teacher',role:'teacher'};
const student={lessonId,learnerId,actorSubject:'signed-owner',role:'learner'};
const frame={type:'ink-preview',phase:'start',strokeId:'ink-preview-00001',
 page:35,seq:0,kind:'pen',color:'#397ca7',width:3,points:[{x:20,y:30}]};
function setup(config:{grant?:boolean;live?:boolean;expired?:boolean;foreign?:boolean;flag?:boolean}={}){
 const entries=new Map<string,unknown>();
 const lease=(role:'teacher'|'learner')=>({
  subject:role==='teacher'?teacher.actorSubject:student.actorSubject,
  learnerId,expiresAtMs:now+(config.expired?-10000:60000)
 });
 const room:RoomRecord={lessonId,revision:1,teacher:lease('teacher'),learner:lease('learner')};
 entries.set('room',room);
 entries.set('quranPage',{page:35,revision:0,edition:'hafs-kfqc-v1.1.1',receipts:[]});
 const storage:LessonRoomStorage={
  async get<T>(key:string){return entries.get(key) as T|undefined;},
  async put<T>(key:string,value:T){entries.set(key,value);},
  async transaction<T>(fn:(txn:Pick<LessonRoomStorage,'get'|'put'>)=>Promise<T>){return fn(storage);}
 };
 const sent:string[]=[],closed:number[]=[];
 function socket(identity:unknown){
  return {readyState:1,bufferedAmount:0,
   deserializeAttachment:()=>identity,send:(raw:string)=>sent.push(raw),
   close:(code:number)=>closed.push(code)} as unknown as WebSocket;
 }
 const source=socket(teacher),dest=socket(config.foreign?
  {...student,learnerId:'another-sibling'}:student);
 const ctx:LessonRoomContext={storage,getWebSockets:()=>[source,dest]};
 const db={prepare:(sql:string)=>({bind:()=>({first:async()=>{
  if(config.grant===false)return null;
  if(sql.includes('SELECT status FROM lessons'))
   return {status:config.live===false?'scheduled':'live'};
  if(sql.includes('SELECT id FROM accounts'))return {id:'owner-account'};
  return {id:lessonId,learnerId,kind:'standard',status:'live',
   startsAtMs:now-10000,endsAtMs:now+50000,role:'teacher'};
 }})})};
 const roomDO=new LessonRoom(ctx,{DB:db as unknown as Env['DB'],
  NOOR_REALTIME_HINTS_ENABLED:'true',
  NOOR_CUMULATIVE_INK_ENABLED:config.flag===false?'false':'true'} as Env);
 return {roomDO,source,sent,closed};
}
test('preview reaches only the second signed participant, with server verified source',async()=>{
 const h=setup();
 await h.roomDO.webSocketMessage(h.source,JSON.stringify(frame));
 assert.equal(h.sent.length,1);
 assert.deepEqual(JSON.parse(h.sent[0]!),{...frame,source:'teacher'});
 assert.deepEqual(h.closed,[]);
});
test('no previews with cumulative gate off, revoked D1 role or stale lease',async()=>{
 for(const opts of [{flag:false},{grant:false},{expired:true}]){
  const h=setup(opts);
  await h.roomDO.webSocketMessage(h.source,JSON.stringify(frame));
  assert.deepEqual(h.sent,[]);
  assert.deepEqual(h.closed,[1008]);
 }
});
test('no previews before Start, cross-sibling, on wrong page or bad payload',async()=>{
 for(const opts of [{live:false},{foreign:true}]){
  const h=setup(opts);
  await h.roomDO.webSocketMessage(h.source,JSON.stringify(frame));
  assert.deepEqual(h.sent,[]);
 }
 const h=setup();
 await h.roomDO.webSocketMessage(h.source,JSON.stringify({...frame,page:36}));
 assert.deepEqual(h.sent,[]);
 const invalid=setup();
 await invalid.roomDO.webSocketMessage(invalid.source,JSON.stringify({...frame,
  persistence:'saved'}));
 assert.deepEqual(invalid.sent,[]);
 assert.deepEqual(invalid.closed,[1008]);
});
