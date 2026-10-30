import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {createHmac} from 'node:crypto';
import {microphoneSids,muteSignedLearnerMicrophone} from '../src/classroom/livekit-mute.ts';
import {liveKitActorNames} from '../src/classroom/livekit-token.ts';
import type {Env,CoreDatabase} from '../src/bindings.ts';

const config={url:'wss://nq-demo.livekit.cloud',key:'EXAMPLE_KEY_1234',
 secret:'not-a-provider-secret-at-least-32-bytes'};
const lessonId='mock-lesson',learnerId='mock-learner';
const teacher='signed-sheikh',owner='signed-household';
const now=1_810_000_000_000;
const access={id:lessonId,learnerId,role:'teacher',status:'live',
 kind:'standard',startsAtMs:now-1000,endsAtMs:now+100000};
function db(active=true):CoreDatabase{return {prepare(sql){
 const stmt={
  bind(...args:unknown[]){void args;return this;},
  async first<T>(){
   if(sql.includes('JOIN teachers t'))return active?access as T:null;
   if(sql.includes('FROM learners learner'))return {authSubject:owner} as T;
   return null;
  },
  async all<T>(){return {results:[] as T[]};},
  async run(){return {success:true,meta:{changes:0}};}
 };
 return stmt;
}};}
function env(active=true):Env{
 return {...{LIVEKIT_URL:config.url,LIVEKIT_API_KEY:config.key,LIVEKIT_API_SECRET:config.secret},
  DB:db(active),LESSON_ROOMS:{idFromName(s){return s;},get(){
   return {async fetch(req){
    const data=await req.json() as Record<string,unknown>;
    assert.equal(data.role,'teacher');assert.equal(data.actorSubject,teacher);
    if(new URL(req.url).pathname==='/internal/learner-microphone-policy'){
     assert.equal(data.action,'lock');
     return Response.json({code:'MIC_POLICY_LOCKED',policy:{locked:true,revision:1}});
    }
    assert.equal(data.action,'heartbeat');
    return Response.json({code:'ROOM_HEARTBEAT',presence:{
     lessonId,teacherPresent:true,learnerPresent:true,bothPresent:true,
     revision:2,leaseTtlMs:25000,mediaReady:false,canStart:false,
    }});
   }};
  }}
 };
}
test('parse only specific learner microphone audio tracks; never camera/screenshare/foreign',()=>{
 assert.deepEqual(microphoneSids({participants:[{identity:'other',tracks:[
  {sid:'CAM1',source:'MICROPHONE',type:'AUDIO'}]}]},'right'),[]);
 assert.deepEqual(microphoneSids({participants:[{identity:'right',tracks:[
  {sid:'AUDIO_ONE',source:'MICROPHONE',type:'AUDIO'},
  {sid:'CAMERA',source:'CAMERA',type:'VIDEO'},
  {sid:'SCREEN',source:'SCREEN_SHARE_AUDIO',type:'AUDIO'},
  {sid:'AUDIO_TWO',source:2,type:0},
 ]}]},'right'),['AUDIO_ONE','AUDIO_TWO']);
 for(const invalid of [null,{},[],{participants:'x'},
  {participants:[{identity:'right',tracks:[{sid:'../malicious',source:2,type:0}]}]},
  {participants:[{identity:'right',tracks:[{sid:'A1',source:2,type:1}]}]},
  {participants:[{identity:'right',tracks:[]},{identity:'right',tracks:[]}]}])
   assert.equal(microphoneSids(invalid,'right'),null);
});
test('server alone selects learner track SID; only true/mute for verified Sheikh',async()=>{
 const actor={lessonId,learnerId,role:'learner' as const,actorSubject:owner};
 const {roomName,identity}=await liveKitActorNames(config,actor);
 const calls:{url:string;body:Record<string,unknown>}[]=[];
 const transport:typeof fetch=async(input,init)=>{
  assert.equal(init?.redirect,'manual');
  const url=String(input);const payload=JSON.parse(String(init?.body)) as Record<string,unknown>;
  const headers=new Headers(init?.headers);
  const token=headers.get('authorization')!.replace('Bearer ','');
  const [header,payloadJWT,sig]=token.split('.');
  assert.ok(header&&payloadJWT&&sig);
  assert.equal(createHmac('sha256',config.secret).update(header+'.'+payloadJWT)
   .digest('base64url'),sig);
  calls.push({url,body:payload});
  if(url.endsWith('ListParticipants'))return Response.json({participants:[
   {identity:'unrelated',tracks:[{sid:'OTHER_MIC',source:2,type:0}]},
   {identity,tracks:[{sid:'STUDENT_MIC',source:2,type:0},
    {sid:'STUDENT_CAMERA',source:1,type:1}]},
  ]});
  return Response.json({track:{sid:'STUDENT_MIC'}});
 };
 const result=await muteSignedLearnerMicrophone(env(),teacher,lessonId,now,transport);
 assert.deepEqual(result,{status:200,code:'LEARNER_MICROPHONE_MUTED',mutedTracks:1,
  policy:{locked:true,revision:1}});
 assert.equal(calls.length,2);
 assert.deepEqual(calls[0]?.body,{room:roomName});
 assert.deepEqual(calls[1]?.body,{room:roomName,identity,
  track_sid:'STUDENT_MIC',muted:true});
 assert.ok(calls[1]!.url.endsWith('/MutePublishedTrack'));
});
test('no microphone reports no-op; provider unavailable never claims mute',async()=>{
 let calls=0;
 const list:typeof fetch=async()=>{
  calls++;return Response.json({participants:[]});
 };
 assert.deepEqual(await muteSignedLearnerMicrophone(env(),teacher,lessonId,now,list),
  {status:200,code:'NO_LEARNER_MICROPHONE',mutedTracks:0,
   policy:{locked:true,revision:1}});
 assert.equal(calls,1);
 const error:typeof fetch=async()=>Response.json({error:'provider down'},{status:503});
 assert.deepEqual(await muteSignedLearnerMicrophone(env(),teacher,lessonId,now,error),
  {status:503,code:'LIVEKIT_ROOM_UNAVAILABLE'});
 const redirect:typeof fetch=async()=>new Response(null,{status:302,headers:{
  Location:'https://redirect.example.invalid'
 }});
 assert.deepEqual(await muteSignedLearnerMicrophone(env(),teacher,lessonId,now,redirect),
  {status:503,code:'LIVEKIT_ROOM_UNAVAILABLE'});
});
test('revoked Sheikh, no DO, no secrets fail closed before provider network',async()=>{
 let called=0;const never:typeof fetch=async()=>{called++;return Response.json({});};
 assert.deepEqual(await muteSignedLearnerMicrophone(env(false),teacher,lessonId,now,never),
  {status:404,code:'NOT_FOUND'});
 const noSecret=env();delete noSecret.LIVEKIT_API_SECRET;
 assert.deepEqual(await muteSignedLearnerMicrophone(noSecret,teacher,lessonId,now,never),
  {status:503,code:'LIVEKIT_NOT_CONFIGURED'});
 const noRoom=env();delete noRoom.LESSON_ROOMS;
 assert.deepEqual(await muteSignedLearnerMicrophone(noRoom,teacher,lessonId,now,never),
  {status:503,code:'CLASSROOM_ROOM_NOT_CONFIGURED'});
 assert.equal(called,0);
});
