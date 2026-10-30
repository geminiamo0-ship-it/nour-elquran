import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseClientInk,forwardVerifiedInk} from '../src/classroom/ink-sync.ts';
import {applyInk,initialInk,parseInkCommand,visibleInk} from '../src/classroom/quran-ink.ts';
import {LessonRoom,type LessonRoomStorage,type RoomRecord} from '../src/classroom/lesson-room.ts';
import type {Env} from '../src/bindings.ts';

const author={lessonId:'lesson-ink',learnerId:'learner-ink',
 actorSubject:'signed-sheikh',role:'teacher' as const};
const learner={...author,actorSubject:'signed-owner',role:'learner' as const};
const mark={id:'ink-stroke-001',page:35,color:'#d0a94c',width:3,kind:'pen' as const,
 points:[{x:100,y:220},{x:140,y:240}]};
const add={...author,action:'add' as const,page:35,expectedRevision:0,
 requestId:'ink-add-00001',stroke:mark};
const hide={...author,action:'hide' as const,page:35,expectedRevision:1,
 requestId:'ink-hide-0001',strokeId:mark.id};
const now=Date.now();
function memory(){
 const items=new Map<string,unknown>();
 const api:LessonRoomStorage={
  async get<T>(key:string){return items.get(key) as T|undefined;},
  async put<T>(key:string,value:T){items.set(key,value);},
  async transaction<T>(f:(s:Pick<LessonRoomStorage,'get'|'put'>)=>Promise<T>){return f(api);}
 };
 return {items,api};
}
function cmd(room:LessonRoom,raw:unknown){
 return room.fetch(new Request('https://room.internal/internal/quran-ink',
  {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(raw)}));
}
test('role spoofing, invalid points, malformed ids and cross-page drawings fail closed',()=>{
 assert.ok(parseClientInk({action:'add',page:35,expectedRevision:0,
  requestId:'ink-add-00001',stroke:mark},'teacher'));
 assert.equal(parseClientInk({action:'add',page:35,expectedRevision:0,
  requestId:'ink-add-00001',stroke:mark},'learner'),null);
 for(const v of [
  {...add,role:'learner'},
  {...add,stroke:{...mark,points:[{x:0,y:0},{x:1001,y:100}]}},
  {...add,stroke:{...mark,page:36}},
  {...add,stroke:{...mark,color:'url(javascript:bad)'}},
  {...add,stroke:{...mark,points:Array.from({length:601},()=>({x:1,y:1}))}},
  {...add,stroke:{...mark,width:5000}},
  {...add,requestId:'short'},
  {...add,lessonId:'wrong/id'}
 ])assert.equal(parseInkCommand(v),null);
 assert.equal(parseClientInk({...add,learnerId:'foreign'},'teacher'),null);
 assert.equal(parseClientInk({action:'snapshot',page:35,actorSubject:'forged'},'learner'),null);
});
test('page-specific ink ledger has CAS, idempotency, tombstones and bounded audit receipts',()=>{
 const a=applyInk(initialInk(35),add);
 assert.equal(a.code,'INK_APPLIED');
 assert.deepEqual(visibleInk(a.next).strokes,[mark]);
 assert.equal(applyInk(a.next,add).code,'INK_REPLAY');
 assert.equal(applyInk(a.next,{...add,requestId:'ink-add-00002'}).code,'INK_CONFLICT');
 const h=applyInk(a.next,hide);
 assert.equal(h.code,'INK_APPLIED');
 assert.deepEqual(visibleInk(h.next).strokes,[]);
 assert.equal(h.next.records[0]?.visible,false);
 assert.equal(applyInk(h.next,hide).code,'INK_REPLAY');
 assert.equal(h.next.records.length,1);
 assert.equal(h.next.revision,2);
});
test('joined teacher writes durable ink, joined learner sees it, erased mark survives as audit',async()=>{
 const {api,items}=memory();
 const room:RoomRecord={lessonId:'lesson-ink',revision:2,
  teacher:{subject:'signed-sheikh',learnerId:'learner-ink',expiresAtMs:now+60000},
  learner:{subject:'signed-owner',learnerId:'learner-ink',expiresAtMs:now+60000}};
 await api.put('room',room);
 await api.put('quranPage',{edition:'hafs-kfqc-v1.1.1',page:35,revision:1,receipts:[]});
 const first=new LessonRoom({storage:api});
 assert.equal((await cmd(first,{...learner,action:'snapshot',page:35})).status,200);
 assert.equal((await cmd(first,{...add,role:'learner',actorSubject:'signed-owner'})).status,400);
 assert.equal((await cmd(first,{...add,actorSubject:'other'})).status,404);
 assert.equal((await cmd(first,{...add,lessonId:'other-lesson'})).status,404);
 const created=await cmd(first,add);
 assert.equal(created.status,200);
 assert.equal((await created.json()).ink.revision,1);
 const reboot=new LessonRoom({storage:api});
 const learnerView=await cmd(reboot,{...learner,action:'snapshot',page:35});
 assert.deepEqual((await learnerView.json()).ink.strokes,[mark]);
 assert.equal((await cmd(reboot,add)).status,200);
 const conflict=await cmd(reboot,{...add,requestId:'new-operation-001'});
 assert.equal(conflict.status,409);
 assert.equal((await conflict.json()).ink.revision,1);
 assert.equal((await cmd(reboot,{...add,page:36,stroke:{...mark,page:36},
  requestId:'not-current-01',expectedRevision:0})).status,409);
 assert.equal((await cmd(reboot,hide)).status,200);
 const final=await cmd(reboot,{...learner,action:'snapshot',page:35});
 assert.deepEqual((await final.json()).ink.strokes,[]);
 assert.equal((items.get('quranInk:35') as {records:{visible:boolean}[]}).records[0]?.visible,false);
 await api.put('room',{...room,teacher:{...room.teacher!,expiresAtMs:now-1}});
 assert.equal((await cmd(reboot,{...add,expectedRevision:2,requestId:'after-expire-1'})).status,404);
});
test('missing binding and malformed DO return fail closed',async()=>{
 assert.deepEqual(await forwardVerifiedInk({} as Env,author,{action:'snapshot',page:35}),
  {status:503,code:'CLASSROOM_ROOM_NOT_CONFIGURED'});
 const broken={LESSON_ROOMS:{idFromName:()=>({}),get:()=>({fetch:async()=>Response.json({
  code:'INK_SNAPSHOT',ink:{page:35,revision:0,strokes:[{...mark,color:'bad'}]}
 })})}} as unknown as Env;
 assert.deepEqual(await forwardVerifiedInk(broken,author,{action:'snapshot',page:35}),
  {status:503,code:'CLASSROOM_INK_UNAVAILABLE'});
});
