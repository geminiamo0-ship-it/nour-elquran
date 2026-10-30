import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseClientCorrection,parseVerifiedCorrection,appendCorrection,
 initialCorrections} from '../src/classroom/live-corrections.ts';
import {LessonRoom,type LessonRoomStorage,type RoomRecord} from '../src/classroom/lesson-room.ts';
const id='0996d89e-1e5b-4d33-9abe-79f255f553eb';
const actor={lessonId:'lesson-c',learnerId:'learner-c',actorSubject:'sheikh-c',role:'teacher' as const};
const note={action:'add' as const,operationId:id,page:42,surah:2,ayah:255,
 kind:'tajweed' as const,text:'مراجعة أحكام المد'};
test('signed Sheikh corrections require exact keys, types and safe length',()=>{
 assert.deepEqual(parseClientCorrection(note),note);
 for(const invalid of [{...note,role:'teacher'},{...note,lessonId:'forged'},
  {...note,kind:'danger'},{...note,page:0},{...note,surah:115},
  {...note,ayah:287},{...note,text:''},{...note,text:'a'.repeat(501)},
  {...note,ayah:null},{...note,operationId:'x'},null,[]])
  assert.equal(parseClientCorrection(invalid),null);
 assert.equal(parseVerifiedCorrection({...actor,...note,role:'learner'}),null);
 assert.equal(parseVerifiedCorrection({...actor,...note,teacherId:'victim'}),null);
 assert.equal(parseVerifiedCorrection({...actor,...note})?.role,'teacher');
});
test('append operationId replays only exact same correction and enforces 120-limit',()=>{
 const first=appendCorrection(initialCorrections(),{...actor,...note},1234);
 assert.equal(first.code,'CORRECTION_SAVED');assert.equal(first.state.revision,1);
 assert.equal(appendCorrection(first.state,{...actor,...note},1235).code,'CORRECTION_REPLAY');
 assert.equal(appendCorrection(first.state,{...actor,...note,text:'changed'},1235).code,
  'CORRECTION_CONFLICT');
 assert.equal(appendCorrection(first.state,{...actor,...note,actorSubject:'other'},1235).code,
  'CORRECTION_CONFLICT');
 assert.equal(appendCorrection({...first.state,
  items:Array.from({length:120},()=>first.state.items[0]!)},
  {...actor,...note,operationId:'2163d489-5a27-4af2-83d0-1c3b7f989eff'},1235).code,
  'CORRECTION_LIMIT');
});
function mem(){
 const entries=new Map<string,unknown>(),now=Date.now();
 const room:RoomRecord={lessonId:actor.lessonId,revision:1,
  teacher:{subject:actor.actorSubject,learnerId:actor.learnerId,expiresAtMs:now+30_000},
  learner:{subject:'owner',learnerId:actor.learnerId,expiresAtMs:now+30_000}};
 const storage:LessonRoomStorage={
  async get<T>(key:string){return entries.get(key) as T|undefined;},
  async put<T>(key:string,value:T){entries.set(key,value);},
  async transaction<T>(fn:(txn:Pick<LessonRoomStorage,'get'|'put'>)=>Promise<T>){
   return fn(storage);
  }
 };
 return {storage,entries,room};
}
function req(room:LessonRoom,payload:unknown){
 return room.fetch(new Request('https://lesson-room.internal/internal/corrections',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)
 }));
}
test('DO binds correction to current selected Ayah; persists through restart; seed private',async()=>{
 const store=mem();
 await store.storage.put('room',store.room);
 await store.storage.put('quranPage',{edition:'hafs-kfqc-v1.1.1',page:42,revision:1,
  verse:{surah:2,ayah:255},receipts:[]});
 let room=new LessonRoom({storage:store.storage});
 assert.equal((await req(room,{...actor,...note,ayah:254})).status,409);
 assert.equal((await req(room,{...actor,...note,role:'learner'})).status,400);
 const saved=await req(room,{...actor,...note});
 assert.equal(saved.status,200);
 assert.equal((await saved.json()).corrections.items.length,1);
 room=new LessonRoom({storage:store.storage});
 const read=await req(room,{...actor,action:'snapshot'});
 assert.equal((await read.json()).corrections.items.length,1);
 assert.equal((await req(room,{...actor,...note})).status,200);
 const state=store.entries.get('teacherCorrections') as {revision:number};
 assert.equal(state.revision,1);
 await store.storage.put('room',{...store.room,teacher:{...store.room.teacher!,
  expiresAtMs:Date.now()-1000}});
 assert.equal((await req(room,{...actor,...note,
  operationId:'2163d489-5a27-4af2-83d0-1c3b7f989eff'})).status,404);
 const seed=await req(room,{...actor,action:'seed'});
 assert.equal((await seed.json()).corrections.items.length,1);
 assert.equal((await req(room,{...actor,actorSubject:'another-sheikh',action:'seed'})).status,404);
});
