import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {createHmac} from 'node:crypto';
import {evictVerifiedLiveKitActor,liveKitRoomServiceURL} from '../src/classroom/livekit-admin.ts';
import {liveKitActorNames} from '../src/classroom/livekit-token.ts';
import type {Env} from '../src/bindings.ts';

const config={url:'wss://nq-mock.livekit.cloud',
 key:'SYNTHETICKEY123',secret:'mock-only-32-byte-livekit-admin-secret-do-not-deploy'};
const actor={lessonId:'lesson-123',learnerId:'learner-123',
 actorSubject:'fake-signed-user',role:'learner' as const};
const env:Env={LIVEKIT_URL:config.url,LIVEKIT_API_KEY:config.key,LIVEKIT_API_SECRET:config.secret};
function claims(token:string){
 const [header,payload,sig]=token.split('.');
 assert.ok(header&&payload&&sig);
 return {
  header:JSON.parse(Buffer.from(header,'base64url').toString()) as Record<string,unknown>,
  payload:JSON.parse(Buffer.from(payload,'base64url').toString()) as Record<string,unknown>,
  signature:sig,body:header+'.'+payload,
 };
}
test('RoomService URL is pinned to HTTPS on exact LiveKit Cloud host',()=>{
 assert.equal(liveKitRoomServiceURL(config),
  'https://nq-mock.livekit.cloud/twirp/livekit.RoomService/RemoveParticipant');
 for(const url of ['wss://nq-mock.livekit.cloud.evil.org',
 'https://nq-mock.livekit.cloud','wss://localhost:7880',
 'wss://nq-mock.livekit.cloud/evil','wss://a:n@q-mock.livekit.cloud'])
  assert.throws(()=>liveKitRoomServiceURL({...config,url}));
});
test('only signed room Admin for one opaque lesson and one opaque participant is sent',async()=>{
 const now=1_792_000_000_000;
 const expected=await liveKitActorNames(config,actor);
 let times=0;
 const transport:typeof fetch=async(input,init)=>{
  times++;
  assert.equal(input,liveKitRoomServiceURL(config));
  assert.equal(init?.method,'POST');
  assert.equal(init?.redirect,'manual');
  const h=new Headers(init!.headers);
  assert.equal(h.get('content-type'),'application/json');
  const bearer=h.get('authorization')!;
  assert.ok(bearer.startsWith('Bearer '));
  const c=claims(bearer.slice(7));
  assert.deepEqual(c.header,{alg:'HS256',typ:'JWT'});
  assert.equal(c.payload.iss,config.key);
  assert.equal(c.payload.exp,Math.floor(now/1000)+60);
  assert.equal(c.payload.nbf,Math.floor(now/1000));
  assert.deepEqual(c.payload.video,{
   room:expected.roomName,roomAdmin:true,roomJoin:false,roomCreate:false,
   roomList:false,roomRecord:false,
  });
  const expectedSig=createHmac('sha256',config.secret).update(c.body).digest('base64url');
  assert.equal(c.signature,expectedSig);
  const body=JSON.parse(String(init!.body)) as Record<string,unknown>;
  assert.deepEqual(body,{room:expected.roomName,identity:expected.identity,
   revoke_token_ts:Math.floor(now/1000)});
  assert.doesNotMatch(JSON.stringify(body),/fake-signed-user|learner-123|lesson-123/);
  return Response.json({});
 };
 assert.equal(await evictVerifiedLiveKitActor(env,actor,now,transport),'removed');
 assert.equal(times,1);
});
test('unconfigured/failed provider always retries and never declares eviction success',async()=>{
 const bad={...env};delete bad.LIVEKIT_API_SECRET;
 let called=0;
 const noFetch:typeof fetch=async()=>{called++;return Response.json({});};
 assert.equal(await evictVerifiedLiveKitActor(bad,actor,Date.now(),noFetch),'unconfigured');
 assert.equal(called,0);
 for(const code of [302,400,401,404,408,429,500,503]){
  assert.equal(await evictVerifiedLiveKitActor(env,actor,Date.now(),async()=>{
   return Response.json({error:'reject'}, {status:code});
  }),'retry');
 }
 assert.equal(await evictVerifiedLiveKitActor(env,actor,Date.now(),async()=>{
  throw new Error('offline');
 }),'retry');
});
