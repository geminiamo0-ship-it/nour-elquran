import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {LessonRoom,type LessonRoomStorage,type RoomRecord} from '../src/classroom/lesson-room.ts';
import {fenceLessonCumulativeInk} from '../src/classroom/quran-ink-end-fence.ts';
import type {Env,CoreDatabase} from '../src/bindings.ts';

const now=Date.now();
const ink={id:'ink-stroke-001',page:35,kind:'pen',color:'#aabbcc',width:3,
 points:[{x:12,y:30},{x:20,y:40}]};
const op={lessonId:'lesson-ink',learnerId:'learner-ink',actorSubject:'signed-sheikh',
 role:'teacher',action:'add',page:35,expectedRevision:0,
 requestId:'ink-add-00001',stroke:ink};
function memory(){
 const items=new Map<string,unknown>(),alarms:number[]=[];
 const store:LessonRoomStorage={
  async get<T>(key:string){return items.get(key) as T|undefined;},
  async put<T>(key:string,value:T){items.set(key,value);},
  async transaction<T>(f:(s:Pick<LessonRoomStorage,'get'|'put'>)=>Promise<T>){return f(store);},
  async setAlarm(ms:number){alarms.push(ms);}
 };
 return {items,alarms,store};
}
function dbStub(){
 let down=false,completed=false;
 const events=new Map<string,unknown[]>(),rows=new Map<string,Record<string,unknown>>();
 const db:CoreDatabase={prepare(sql){
  let args:unknown[]=[];
  return {bind(...v:unknown[]){args=v;return this;},
   async first<T>(){
    if(sql.includes('FROM lessons l')&&sql.includes('l.learner_id AS learnerId'))
     return {id:'lesson-ink',learnerId:'learner-ink',status:completed?'completed':'live',
      startsAtMs:now-50000,endsAtMs:now+50000,role:'teacher',
      kind:'trial',teacherScope:'primary'} as T;
    if(sql.includes('SELECT status FROM lessons'))
     return {status:completed?'completed':'live'} as T;
    if(sql.includes('SELECT 1 AS allowed'))return {allowed:1} as T;
    if(sql.includes('FROM learner_quran_events'))return (
      events.has(String(args[1]))?{operation_id:args[1]}:null) as T|null;
    if(sql.includes('FROM learner_quran_current'))
     return (rows.get(String(args[1]))??null) as T|null;
    return null;
   },async all<T>(){return {results:[] as T[]};},
   async run(){
    if(!sql.includes('INSERT INTO learner_quran_events'))throw Error('UNEXPECTED_SQL');
    if(down)throw Error('D1_NETWORK_OFFLINE');
    const operationId=String(args[2]),itemId=String(args[3]);
    events.set(operationId,args);
    rows.set(itemId,{
     item_id:itemId,page:35,kind:'pen',surah:null,ayah:null,
     word_index:null,visible:1,revision:1,audience:'shared',
     author_role:'teacher',author_subject:'signed-sheikh',
     origin_type:'lesson',origin_id:'lesson-ink',payload_json:args[17],
    });
    return {success:true,meta:{changes:1}};
   }};
 }};
 return {db,events,setDown:(v:boolean)=>{down=v;},setEnded:(v:boolean)=>{completed=v;}};
}
const signed={lessonId:'lesson-ink',learnerId:'learner-ink',actorSubject:'signed-sheikh'};
const roomRequest=(instance:LessonRoom,body:unknown)=>instance.fetch(new Request(
 'https://room.internal/internal/quran-ink',{method:'POST',
 headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
test('D1 outage: room ink and ordered pending outbox commit atomically; reboot replays',async()=>{
 const {store,items,alarms}=memory(),db=dbStub();
 db.setDown(true);
 const room:RoomRecord={lessonId:'lesson-ink',revision:1,
  teacher:{subject:'signed-sheikh',learnerId:'learner-ink',expiresAtMs:now+60000},
  learner:null};
 await store.put('room',room);
 await store.put('quranPage',{edition:'hafs-kfqc-v1.1.1',page:35,revision:1,receipts:[]});
 const env:Env={DB:db.db,NOOR_CUMULATIVE_INK_ENABLED:'true'};
 const first=new LessonRoom({storage:store},env);
 const result=await roomRequest(first,op);
 assert.equal(result.status,202);
 assert.equal((await result.json() as {code:string}).code,'INK_PENDING_PERSISTENCE');
 assert.equal((items.get('pendingQuranInk') as unknown[]).length,1);
 assert.equal((items.get('quranInk:35') as {records:unknown[]}).records.length,1);
 assert.ok(alarms.length>0);
 const namespace={idFromName:()=>({}),get:()=>({fetch:(req:Request)=>first.fetch(req)})};
 const pending=await fenceLessonCumulativeInk({...env,LESSON_ROOMS:namespace},...Object.values(signed));
 assert.deepEqual(pending,{status:409,code:'QURAN_INK_PENDING'});
 assert.equal(items.get('quranInkClosing'),undefined);
 db.setDown(false);
 const reboot=new LessonRoom({storage:store},env);
 await reboot.alarm();
 assert.equal((items.get('pendingQuranInk') as unknown[]).length,0);
 assert.equal(db.events.size,1);
 await reboot.alarm();
 assert.equal(db.events.size,1,'retry must not create another D1 event');
 const ns={idFromName:()=>({}),get:()=>({fetch:(req:Request)=>reboot.fetch(req)})};
 const fence=await fenceLessonCumulativeInk({...env,LESSON_ROOMS:ns},
  signed.lessonId,signed.learnerId,signed.actorSubject);
 assert.deepEqual(fence,{status:200,code:'QURAN_INK_FENCED'});
 const rejected=await roomRequest(reboot,{...op,expectedRevision:1,
  requestId:'new-operation-001',stroke:{...ink,id:'ink-stroke-002'}});
 assert.equal(rejected.status,409);
 assert.equal(db.events.size,1);
});
test('missing D1 or revoked identity denies gated room write without local stroke',async()=>{
 const {store,items}=memory();
 await store.put('room',{lessonId:'lesson-ink',revision:1,
  teacher:{subject:'signed-sheikh',learnerId:'learner-ink',expiresAtMs:now+60000},
  learner:null});
 await store.put('quranPage',{edition:'hafs-kfqc-v1.1.1',page:35,revision:1,receipts:[]});
 const missing=new LessonRoom({storage:store},{NOOR_CUMULATIVE_INK_ENABLED:'true'});
 assert.equal((await roomRequest(missing,op)).status,503);
 assert.equal(items.get('quranInk:35'),undefined);
 const foreign=new LessonRoom({storage:store},{NOOR_CUMULATIVE_INK_ENABLED:'true',
  DB:{prepare(){throw Error('unauthorized');}}});
 assert.equal((await roomRequest(foreign,op)).status,503);
 assert.equal(items.get('pendingQuranInk'),undefined);
});
