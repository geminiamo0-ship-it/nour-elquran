import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseClientInk,forwardVerifiedInk} from '../src/classroom/ink-sync.ts';
import {applyInk,initialInk,parseInkCommand,visibleInk} from '../src/classroom/quran-ink.ts';
import {LessonRoom,type LessonRoomStorage,type RoomRecord} from '../src/classroom/lesson-room.ts';
import type {Env,CoreDatabase,D1Statement} from '../src/bindings.ts';

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
function ledgerDb(){
 const operations=new Map<string,Record<string,unknown>>();
 const items=new Map<string,Record<string,unknown>>();
 let available=true,status='live';
 const db:CoreDatabase={
  prepare(sql:string){
   let args:unknown[]=[];
   const stmt:D1Statement={
    bind(...values){args=values;return this;},
    async first<T>(){
     if(!available)throw Error('D1_OFFLINE');
     if(sql.startsWith('SELECT status FROM lessons'))return {status} as T;
     if(sql.includes('SELECT 1 AS allowed FROM learners')||
       sql.includes('SELECT 1 AS allowed FROM lessons')||
       sql.includes('SELECT 1 AS allowed FROM lessons l'))return {allowed:1} as T;
     if(sql.startsWith('SELECT actor_subject'))return (operations.get(String(args[1]))??null) as T|null;
     if(sql.startsWith('SELECT item_id'))return (items.get(String(args[1]))??null) as T|null;
     return null;
    },
    async all<T>(){return {results:[] as T[]};},
    async run(){
     if(!available)throw Error('D1_OFFLINE');
     if(sql.startsWith('INSERT INTO learner_quran_events')){
      const op=String(args[2]),item=String(args[3]),action=String(args[9]);
      if(operations.has(op))throw Error('constraint');
      operations.set(op,{actor_subject:args[4],actor_role:args[5],
       action,origin_type:args[6],origin_id:args[7],item_id:item,
       kind:args[15],page:args[11],surah:args[12],ayah:args[13],
       word_index:args[14],expected_revision:args[16],payload_json:args[17]});
      const old=items.get(item);
      items.set(item,{item_id:item,page:args[11],kind:args[15],
       surah:args[12],ayah:args[13],word_index:args[14],
       visible:action==='put'?1:0,revision:Number(args[16])+1,
       audience:'shared',author_role:old?.author_role??args[5],
       author_subject:old?.author_subject??args[4],
       origin_type:args[6],origin_id:args[7],
       payload_json:action==='put'?args[17]:old?.payload_json??'{}'});
     }
     return {success:true,meta:{changes:1}};
    }
   };return stmt;
  }
 };
 return {db,items,operations,setAvailable(v:boolean){available=v;},
  setPhase(v:string){status=v;}};
}
function memory(){
 const items=new Map<string,unknown>();
 const api:LessonRoomStorage={
  async setAlarm(){},
  async get<T>(key:string){return items.get(key) as T|undefined;},
  async put<T>(key:string,value:T){items.set(key,value);},
  async transaction<T>(f:(s:Pick<LessonRoomStorage,'get'|'put'>)=>Promise<T>){return f(api);}
 };
 const ledger=ledgerDb();
 return {items,api,ledger,env:{DB:ledger.db} as Env};
}
function cmd(room:LessonRoom,raw:unknown){
 return room.fetch(new Request('https://room.internal/internal/quran-ink',
  {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(raw)}));
}
test('role spoofing, invalid points, malformed ids and cross-page drawings fail closed',()=>{
 assert.ok(parseClientInk({action:'add',page:35,expectedRevision:0,
  requestId:'ink-add-00001',stroke:mark},'teacher'));
 assert.ok(parseClientInk({action:'add',page:35,expectedRevision:0,
  requestId:'ink-add-00001',stroke:mark},'learner'));
 assert.ok(parseInkCommand({...add,role:'learner',actorSubject:'signed-owner'}));
 for(const v of [
  {...add,role:'intruder'},
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
 const {api,items,env}=memory();
 const room:RoomRecord={lessonId:'lesson-ink',revision:2,
  teacher:{subject:'signed-sheikh',learnerId:'learner-ink',expiresAtMs:now+60000},
  learner:{subject:'signed-owner',learnerId:'learner-ink',expiresAtMs:now+60000}};
 await api.put('room',room);
 await api.put('quranPage',{edition:'hafs-kfqc-v1.1.1',page:35,revision:1,receipts:[]});
 const first=new LessonRoom({storage:api},env);
 assert.equal((await cmd(first,{...learner,action:'snapshot',page:35})).status,200);
 assert.equal((await cmd(first,{...add,actorSubject:'other'})).status,404);
 assert.equal((await cmd(first,{...add,lessonId:'other-lesson'})).status,404);
 const created=await cmd(first,add);
 assert.equal(created.status,200);
 assert.equal((await created.json()).ink.revision,1);
 // Even with a valid lease, the learner cannot erase a teacher's mark.
 assert.equal((await cmd(first,{...hide,role:'learner',actorSubject:'signed-owner'})).status,409);
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

// Signatures and authors must remain genuine across DO reboot and moderation.
// The student's own pen is accepted ONLY from their verified lease; they
// cannot erase the teacher's mark, but the Sheikh can moderate their stroke.
test('learner shared ink preserves provenance and Sheikh moderation across DO reboot',async()=>{
 const {api,items}=memory();
 const room:RoomRecord={lessonId:'lesson-ink',revision:2,
  teacher:{subject:'signed-sheikh',learnerId:'learner-ink',expiresAtMs:now+60000},
  learner:{subject:'signed-owner',learnerId:'learner-ink',expiresAtMs:now+60000}};
 await api.put('room',room);
 await api.put('quranPage',{edition:'hafs-kfqc-v1.1.1',page:35,revision:1,receipts:[]});
 const teacherAdd=add;
 const childMark={...mark,id:'ink-child-001'};
 const childAdd={...add,role:'learner' as const,actorSubject:'signed-owner',
  stroke:childMark,requestId:'child-write-001',expectedRevision:1};
 const instance=new LessonRoom({storage:api});
 assert.equal((await cmd(instance,teacherAdd)).status,200);
 assert.equal((await cmd(instance,childAdd)).status,200);
 const state=items.get('quranInk:35') as {records:readonly {author:string;subject:string;visible:boolean}[]};
 assert.deepEqual(state.records.map(x=>[x.author,x.subject]),[
  ['teacher','signed-sheikh'],['learner','signed-owner']]);
 const booted=new LessonRoom({storage:api});
 assert.equal((await cmd(booted,childAdd)).status,200);
 const childHideTeacher={...hide,role:'learner' as const,actorSubject:'signed-owner',
  expectedRevision:2,requestId:'child-hide-01'};
 assert.equal((await cmd(booted,childHideTeacher)).status,409);
 const moderation={...hide,strokeId:childMark.id,expectedRevision:2,
  requestId:'moderation-001'};
 assert.equal((await cmd(booted,moderation)).status,200);
 const latest=items.get('quranInk:35') as {records:readonly {author:string;subject:string;visible:boolean}[]};
 assert.deepEqual(latest.records.map(x=>[x.author,x.visible]),[
  ['teacher',true],['learner',false]]);
 assert.equal((await cmd(booted,moderation)).status,200);
 assert.equal((await cmd(booted,{...childAdd,stroke:{...childMark,id:'other-child-001'}})).status,409);
});

test('D1 write outage retains queued room mark through restart, alarm replays exactly once',async()=>{
 const {api,items,ledger,env}=memory();
 await api.put('room',{lessonId:'lesson-ink',revision:2,
  teacher:{subject:'signed-sheikh',learnerId:'learner-ink',expiresAtMs:Date.now()+60000},
  learner:{subject:'signed-owner',learnerId:'learner-ink',expiresAtMs:Date.now()+60000}});
 await api.put('quranPage',{edition:'hafs-kfqc-v1.1.1',page:35,revision:1,receipts:[]});
 ledger.setAvailable(false);
 const first=new LessonRoom({storage:api},env);
 const sent=await cmd(first,add);
 assert.equal(sent.status,503);
 assert.equal((await sent.json()).code,'INK_SAVE_PENDING');
 assert.equal((items.get('pendingQuranInk') as unknown[]).length,1);
 assert.equal(ledger.operations.size,0);
 ledger.setAvailable(true);
 const reboot=new LessonRoom({storage:api},env);
 await reboot.alarm();
 assert.equal((items.get('pendingQuranInk') as unknown[]).length,0);
 assert.equal(ledger.operations.size,1);
 assert.equal(ledger.items.size,1);
 await reboot.alarm();
 assert.equal(ledger.operations.size,1);
 assert.equal((await cmd(reboot,add)).status,200);
 const afterEnd=ledger.setPhase('completed');
 void afterEnd;
 assert.equal((await cmd(reboot,{...add,expectedRevision:1,
  requestId:'fresh-after-end-01',stroke:{...mark,id:'new-stroke-0001'}})).status,409);
});
