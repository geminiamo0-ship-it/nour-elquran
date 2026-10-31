import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {openVerifiedRealtime,validRealtimeHint,validVerifiedRealtimeActor} from '../src/classroom/realtime.ts';
import type {Env} from '../src/bindings.ts';

const actor={lessonId:'lesson-35',learnerId:'learner-a',
 actorSubject:'signed-teacher',role:'teacher' as const};
const origin='https://noor-site-staging.geminiamo0.workers.dev';
function request(headers:Record<string,string>,method='GET'){
 return new Request(origin+'/v1/teacher/lessons/lesson-35/realtime',{method,headers});
}
test('realtime hints are narrow revision notifications only; never fake D1 save receipts',()=>{
 assert.ok(validRealtimeHint({type:'quran-page',page:35,revision:2}));
 assert.ok(validRealtimeHint({type:'quran-ink',page:604,revision:0}));
 for(const hint of [
  {type:'quran-page',page:605,revision:1},
  {type:'quran-ink',page:35,revision:-1},
  {type:'quran-ink',page:35,revision:1,persistence:'saved'},
  {type:'student-private-note',page:35,revision:1},
  {type:'quran-ink',page:35,revision:'1'},
  {type:'quran-ink',page:35,revision:1,strokes:[{}]},
  null
 ])assert.equal(validRealtimeHint(hint),false);
});
test('actor envelope must be server verified and cannot claim extra privilege',()=>{
 assert.equal(validVerifiedRealtimeActor(actor),true);
 assert.equal(validVerifiedRealtimeActor({...actor,role:'admin'}),false);
 assert.equal(validVerifiedRealtimeActor({...actor,subject:'forged'}),false);
 assert.equal(validVerifiedRealtimeActor({...actor,lessonId:'../../other'}),false);
 assert.equal(validVerifiedRealtimeActor({...actor,learnerId:null}),false);
});
test('handshake is exact same origin, GET upgrade only, and closed if binding unavailable',async()=>{
 const none={} as Env;
 assert.equal((await openVerifiedRealtime(none,actor,request({Origin:'https://evil.example',Upgrade:'websocket'}))).status,403);
 assert.equal((await openVerifiedRealtime(none,actor,request({Upgrade:'websocket'}))).status,403);
 assert.equal((await openVerifiedRealtime(none,actor,request({Origin:origin}))).status,426);
 assert.equal((await openVerifiedRealtime(none,actor,request({Origin:origin,Upgrade:'websocket'}))).status,404);
 assert.equal((await openVerifiedRealtime({NOOR_REALTIME_HINTS_ENABLED:'true'} as Env,
  actor,request({Origin:origin,Upgrade:'websocket'}))).status,503);
});
test('only server-derived actor envelope reaches the exact lesson DO; no browser cookie forwarded',async()=>{
 let called=false,stubReq:Request|undefined;
 const env={NOOR_REALTIME_HINTS_ENABLED:'true',LESSON_ROOMS:{
  idFromName:(name:string)=>{assert.equal(name,'lesson-35');return name;},
  get:(id:string)=>{assert.equal(id,'lesson-35');return{fetch:async(r:Request)=>{
   called=true;stubReq=r;return new Response('forwarded');
  }};},
 }} as unknown as Env;
 const result=await openVerifiedRealtime(env,actor,request({
  Origin:origin,Upgrade:'websocket',Cookie:'session=secret','x-noor-role':'admin'
 }));
 assert.equal(result.status,200);
 assert.equal(called,true);
 assert.equal(stubReq?.headers.get('cookie'),null);
 assert.equal(stubReq?.headers.get('x-noor-role'),'teacher');
 assert.equal(stubReq?.headers.get('x-noor-subject'),'signed-teacher');
 assert.equal(new URL(stubReq!.url).hostname,'lesson-room.internal');
});
