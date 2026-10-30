import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {createHmac} from 'node:crypto';
import {
 MEDIA_TOKEN_TTL_SECONDS,MEDIA_EARLY_JOIN_MS,validatedLiveKitConfig,
 mediaLessonWindow,mintLiveKitToken,createMediaToken,
} from '../src/classroom/livekit-token.ts';
import type {ClassroomAccess} from '../src/classroom-access.ts';
import type {Env} from '../src/bindings.ts';

const fakeKey='API123456abcdefg',fakeSecret='only-synthetic-test-secret-which-is-never-livekit';
const config={url:'wss://example-123.livekit.cloud',key:fakeKey,secret:fakeSecret};
const actor={lessonId:'lesson-opaque-1',learnerId:'learner-opaque-1',
 actorSubject:'synthetic-auth-subject',role:'learner' as const};
const lesson:ClassroomAccess={id:actor.lessonId,learnerId:actor.learnerId,
 kind:'standard',status:'scheduled',startsAtMs:1_000_000,endsAtMs:3_400_000,
 role:'learner'};
function environment(present=true):Env{
 return {...{
  LIVEKIT_URL:config.url,LIVEKIT_API_KEY:config.key,LIVEKIT_API_SECRET:config.secret,
 },LESSON_ROOMS:{idFromName(name:string){return name;},get(name:unknown){
  assert.equal(name,actor.lessonId);
  return {async fetch(req:Request){
   const value=await req.json() as Record<string,unknown>;
   assert.equal(value.lessonId,actor.lessonId);
   assert.equal(value.role,actor.role);
   assert.equal(value.actorSubject,actor.actorSubject);
   assert.equal(value.learnerId,actor.learnerId);
   assert.equal(value.action,'heartbeat');
   if(!present)return Response.json({code:'NOT_JOINED'},{status:404});
   return Response.json({code:'ROOM_HEARTBEAT',presence:{
    lessonId:actor.lessonId,teacherPresent:false,learnerPresent:true,
    bothPresent:false,revision:4,leaseTtlMs:25000,
    canStart:false,mediaReady:false,
   }});
  }};
 }}};
}
function claims(token:string){
 const [head,body,sig]=token.split('.');
 assert.ok(head&&body&&sig);
 const h=JSON.parse(Buffer.from(head,'base64url').toString()) as Record<string,unknown>;
 const c=JSON.parse(Buffer.from(body,'base64url').toString()) as Record<string,unknown>;
 return {head:h,body:c,signature:sig,signingInput:head+'.'+body};
}
test('LiveKit Cloud URL/credential validation fails closed for fake/custom/insecure endpoints',()=>{
 const ok=validatedLiveKitConfig({...environment(),LIVEKIT_URL:config.url});
 assert.ok(ok);
 assert.equal(ok.url,config.url);
 for(const url of ['http://example-123.livekit.cloud','ws://example-123.livekit.cloud',
  'wss://example-123.livekit.cloud:7880','wss://example-123.livekit.cloud/path',
  'wss://example-123.livekit.cloud/?token=abc',
  'wss://admin:pw@example-123.livekit.cloud',
  'wss://example-123.livekit.cloud.evil.org','wss://livekit.cloud',
  'wss://localhost:7880','https://example-123.livekit.cloud','javascript:alert(1)'])
  assert.equal(validatedLiveKitConfig({...environment(),LIVEKIT_URL:url}),null,url);
 for(const env of [
  {...environment(),LIVEKIT_URL:undefined},
  {...environment(),LIVEKIT_API_KEY:undefined},
  {...environment(),LIVEKIT_API_SECRET:undefined},
  {...environment(),LIVEKIT_API_SECRET:'tiny'},
  {...environment(),LIVEKIT_API_KEY:'bad key'},
 ])assert.equal(validatedLiveKitConfig(env),null);
});
test('signed JWT is verified with HMAC-SHA256, time-bound, opaque, strict camera/mic only',async()=>{
 const issued=await mintLiveKitToken(config,actor,1_050_000);
 const c=claims(issued.token);
 assert.deepEqual(c.head,{alg:'HS256',typ:'JWT'});
 assert.equal(c.body.iss,fakeKey);
 assert.equal(c.body.nbf,1050);
 assert.equal(c.body.iat,1050);
 assert.equal(c.body.exp,1050+MEDIA_TOKEN_TTL_SECONDS);
 assert.equal(issued.expiresAt,c.body.exp);
 assert.equal(c.body.sub,issued.identity);
 assert.ok(issued.roomName.startsWith('nq-'));
 assert.notEqual(issued.roomName,actor.lessonId);
 assert.notEqual(issued.identity,actor.actorSubject);
 const v=c.body.video as Record<string,unknown>;
 assert.deepEqual(v,{
  room:issued.roomName,roomJoin:true,roomAdmin:false,roomCreate:false,
  roomList:false,roomRecord:false,canPublish:true,
  canPublishSources:['camera','microphone'],canPublishData:false,
  canSubscribe:true,canUpdateOwnMetadata:false,
 });
 const verified=createHmac('sha256',fakeSecret).update(c.signingInput).digest('base64url');
 assert.equal(c.signature,verified,'WebCrypto JWT must be verifiable with standard HS256');
 assert.doesNotMatch(issued.token,/synthetic-auth-subject|learner-opaque|lesson-opaque/);
 const second=await mintLiveKitToken(config,actor,1_051_000);
 assert.equal(second.roomName,issued.roomName);
 assert.equal(second.identity,issued.identity);
 assert.notEqual(second.token,issued.token);
 const other=await mintLiveKitToken(config,{...actor,role:'teacher'},1_050_000);
 assert.equal(other.roomName,issued.roomName);
 assert.notEqual(other.identity,issued.identity);
});
test('scheduled admission limited to 15 minutes before start, still no automatic class end for live',()=>{
 assert.equal(mediaLessonWindow(lesson,lesson.startsAtMs-MEDIA_EARLY_JOIN_MS-1),false);
 assert.equal(mediaLessonWindow(lesson,lesson.startsAtMs-MEDIA_EARLY_JOIN_MS),true);
 assert.equal(mediaLessonWindow(lesson,lesson.endsAtMs),true);
 assert.equal(mediaLessonWindow(lesson,lesson.endsAtMs+1),false);
 assert.equal(mediaLessonWindow({...lesson,status:'live'},lesson.endsAtMs+100000000),true);
 assert.equal(mediaLessonWindow({...lesson,startsAtMs:Number.NaN},1000),false);
 assert.equal(mediaLessonWindow({...lesson,endsAtMs:0},1000),false);
});
test('issuer rejects absent config, no DO binding, expired lease and wrong learner/role',async()=>{
 const env=environment();
 assert.deepEqual(await createMediaToken({...env,LIVEKIT_API_SECRET:undefined},actor,lesson,1_050_000),
  {status:503,code:'LIVEKIT_NOT_CONFIGURED'});
 assert.deepEqual(await createMediaToken({...env,LESSON_ROOMS:undefined},actor,lesson,1_050_000),
  {status:503,code:'CLASSROOM_ROOM_NOT_CONFIGURED'});
 assert.deepEqual(await createMediaToken(environment(false),actor,lesson,1_050_000),
  {status:404,code:'NOT_JOINED'});
 for(const access of [
  {...lesson,id:'other'},
  {...lesson,learnerId:'other'},
  {...lesson,role:'teacher' as const},
  {...lesson,startsAtMs:9_000_000,endsAtMs:10_000_000},
 ]){
  assert.deepEqual(await createMediaToken(env,actor,access,1_050_000),
   {status:404,code:'MEDIA_LESSON_UNAVAILABLE'});
 }
 const good=await createMediaToken(env,actor,lesson,1_050_000);
 assert.equal(good.status,200);
 if(good.status===200){
  assert.equal(good.serverUrl,config.url);
  assert.equal(good.expiresInSeconds,120);
  assert.equal(typeof good.participantToken,'string');
  assert.equal(good.participantToken.split('.').length,3);
 }
});
