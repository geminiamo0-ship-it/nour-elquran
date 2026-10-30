import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parsePageAction,forwardVerifiedPage} from '../src/classroom/quran-sync.ts';
import {initialPage,applyPageSet,parseVerifiedPageCommand} from '../src/classroom/quran-page.ts';
import {LessonRoom,type LessonRoomStorage,type RoomRecord} from '../src/classroom/lesson-room.ts';
import type {Env} from '../src/bindings.ts';

const verified={lessonId:'lesson-q',learnerId:'learner-q',actorSubject:'sheikh-q',role:'teacher' as const};
const student={...verified,role:'learner' as const,actorSubject:'owner-q'};
const now=Date.now();
function storage(){
 const items=new Map<string,unknown>();
 const api:LessonRoomStorage={
  async get<T>(key:string){return items.get(key) as T|undefined;},
  async put<T>(key:string,value:T){items.set(key,value);},
  async transaction<T>(fn:(s:Pick<LessonRoomStorage,'get'|'put'>)=>Promise<T>){return fn(api);}
 };
 return {api,items};
}
function endpoint(room:LessonRoom,body:unknown){
 return room.fetch(new Request('https://internal.invalid/internal/quran-page',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)
 }));
}
function request(action:'snapshot'|'set',page=35,expectedRevision=0,requestId='change-0001'){
 return {...verified,action,...(action==='set'?{page,expectedRevision,requestId}:{})};
}
test('public page input cannot forge role, lesson, learner or implicit operations',()=>{
 assert.deepEqual(parsePageAction({action:'set',page:35,expectedRevision:0,requestId:'change-0001'},'teacher'),
  {action:'set',page:35,expectedRevision:0,requestId:'change-0001'});
 for(const invalid of [
  {action:'set',page:0,expectedRevision:0,requestId:'change-0001'},
  {action:'set',page:605,expectedRevision:0,requestId:'change-0001'},
  {action:'set',page:4.5,expectedRevision:0,requestId:'change-0001'},
  {action:'set',page:35,expectedRevision:-1,requestId:'change-0001'},
  {action:'set',page:35,expectedRevision:0,requestId:'bad'},
  {action:'set',page:35,expectedRevision:0,requestId:'change-0001',role:'teacher'},
  {action:'set',page:35,expectedRevision:0,requestId:'change-0001',learnerId:'other'}
 ])assert.equal(parsePageAction(invalid,'teacher'),null);
 assert.equal(parsePageAction({action:'set',page:35,expectedRevision:0,requestId:'change-0001'},'learner'),null);
 assert.equal(parseVerifiedPageCommand({...student,action:'set',page:35,expectedRevision:0,
  requestId:'change-0001'}),null);
});
test('canonical edition, revision fencing, bounded replay and different-id conflict',()=>{
 let s=initialPage();
 assert.deepEqual(s,{edition:'hafs-kfqc-v1.1.1',page:1,revision:0,receipts:[]});
 let a=applyPageSet(s,request('set'));
 assert.equal(a.code,'QURAN_PAGE_SET');
 assert.equal(a.next.page,35);assert.equal(a.next.revision,1);
 assert.equal(applyPageSet(a.next,request('set')).code,'QURAN_PAGE_REPLAY');
 assert.equal(applyPageSet(a.next,request('set',36,0,'change-0002')).code,'QURAN_PAGE_CONFLICT');
 assert.equal(applyPageSet(a.next,request('set',36,1,'change-0001')).code,'QURAN_PAGE_CONFLICT');
 s=a.next;
 for(let i=0;i<40;i++){
  const result=applyPageSet(s,request('set',35+i,1+i,'change-'+String(i+100).padStart(4,'0')));
  assert.equal(result.code,'QURAN_PAGE_SET');s=result.next;
 }
 assert.equal(s.receipts.length,32);
});
test('LessonDO only mutates page for signed joined sheikh, student read-only, survives restart',async()=>{
 const {api,items}=storage();
 const storeRoom:RoomRecord={lessonId:'lesson-q',revision:2,
  teacher:{subject:'sheikh-q',learnerId:'learner-q',expiresAtMs:now+60_000},
  learner:{subject:'owner-q',learnerId:'learner-q',expiresAtMs:now+60_000}};
 await api.put('room',storeRoom);
 const room=new LessonRoom({storage:api});
 const before=await endpoint(room,{...student,action:'snapshot'});
 assert.equal(before.status,200);
 assert.deepEqual((await before.json()).quran,{edition:'hafs-kfqc-v1.1.1',page:1,revision:0});
 const bad=await endpoint(room,{...student,action:'set',page:36,expectedRevision:0,requestId:'change-0033'});
 assert.equal(bad.status,400);
 assert.equal((await endpoint(room,{...verified,actorSubject:'stranger',action:'snapshot'})).status,404);
 assert.equal((await endpoint(room,{...verified,lessonId:'foreign',action:'snapshot'})).status,404);
 assert.equal((await endpoint(room,request('set'))).status,200);
 const reboot=new LessonRoom({storage:api});
 const read=await endpoint(reboot,{...student,action:'snapshot'});
 assert.deepEqual((await read.json()).quran,{edition:'hafs-kfqc-v1.1.1',page:35,revision:1});
 assert.equal((await endpoint(reboot,request('set'))).status,200);
 const collision=await endpoint(reboot,request('set',37,0,'change-0044'));
 assert.equal(collision.status,409);
 assert.equal((await collision.json()).quran.revision,1);
 const expired={...storeRoom,teacher:{...storeRoom.teacher!,expiresAtMs:now-1}};
 await api.put('room',expired);
 assert.equal((await endpoint(reboot,request('set',37,1,'change-0045'))).status,404);
 assert.equal((items.get('quranPage') as {revision:number}).revision,1);
});
test('forwarder fails closed on absent binding, corrupt/mismatched edition',async()=>{
 assert.deepEqual(await forwardVerifiedPage({} as Env,verified,{action:'snapshot'}),
  {status:503,code:'CLASSROOM_ROOM_NOT_CONFIGURED'});
 const env={LESSON_ROOMS:{idFromName:()=>({}),get:()=>({fetch:async()=>Response.json({
  code:'QURAN_PAGE_SNAPSHOT',quran:{edition:'fake',page:604,revision:0}
 })})}} as unknown as Env;
 assert.deepEqual(await forwardVerifiedPage(env,verified,{action:'snapshot'}),
  {status:503,code:'CLASSROOM_QURAN_UNAVAILABLE'});
});
