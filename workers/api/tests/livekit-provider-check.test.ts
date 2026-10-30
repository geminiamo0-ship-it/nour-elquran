import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createHmac} from 'node:crypto';
import {checkLiveKitProvider} from '../src/classroom/livekit-provider-check.ts';
import {liveKitActorNames} from '../src/classroom/livekit-token.ts';
import type {Env} from '../src/bindings.ts';

const config={url:'wss://synthetic.livekit.cloud',key:'SYNTHETICKEY123',
 secret:'only-synthetic-test-secret-livekit-do-not-deploy'};
const env:Env={NOOR_ENVIRONMENT:'staging',NOOR_DEV_OPEN:'true',
 LIVEKIT_URL:config.url,LIVEKIT_API_KEY:config.key,LIVEKIT_API_SECRET:config.secret};
const actor={lessonId:'synthetic-lesson',learnerId:'synthetic-learner',
 role:'teacher' as const,actorSubject:'synthetic-actor'};

test('read-only provider JWT is valid HS256, 30s, roomList only, room-filtered',async()=>{
 const now=1792000000000;
 const {roomName}=await liveKitActorNames(config,actor);
 let calls=0;
 const result=await checkLiveKitProvider(env,actor,now,async(url,init)=>{
  calls++;
  assert.equal(url,'https://synthetic.livekit.cloud/twirp/livekit.RoomService/ListRooms');
  assert.equal(init?.method,'POST');assert.equal(init?.redirect,'error');
  assert.deepEqual(JSON.parse(String(init?.body)),{names:[roomName]});
  assert.doesNotMatch(String(init?.body),/synthetic-lesson|synthetic-actor/);
  const token=new Headers(init?.headers).get('authorization');
  assert.ok(token?.startsWith('Bearer '));
  const [h,p,s]=token!.slice(7).split('.');
  assert.ok(h&&p&&s);
  const header=JSON.parse(Buffer.from(h,'base64url').toString());
  const claim=JSON.parse(Buffer.from(p,'base64url').toString());
  assert.deepEqual(header,{alg:'HS256',typ:'JWT'});
  assert.equal(claim.iss,config.key);assert.equal(claim.iat,Math.floor(now/1000));
  assert.equal(claim.exp,Math.floor(now/1000)+30);
  assert.deepEqual(claim.video,{roomList:true,roomJoin:false,roomAdmin:false,
   roomCreate:false,roomRecord:false});
  assert.equal(s,createHmac('sha256',config.secret).update(h+'.'+p).digest('base64url'));
  return Response.json({});
 });
 assert.deepEqual(result,{status:200,code:'LIVEKIT_PROVIDER_REACHABLE'});
 assert.equal(calls,1);
});
test('production, learner and missing secrets never contact provider',async()=>{
 let count=0;
 const mock:typeof fetch=async()=>{count++;throw Error('network forbidden');};
 for(const bad of [{...env,NOOR_ENVIRONMENT:'production'}, {...env,NOOR_DEV_OPEN:'false'}]){
  assert.equal((await checkLiveKitProvider(bad,actor,Date.now(),mock)).status,503);
 }
 assert.equal((await checkLiveKitProvider(env,{...actor,role:'learner'},Date.now(),mock)).status,503);
 assert.deepEqual(await checkLiveKitProvider({...env,LIVEKIT_API_SECRET:undefined},actor,Date.now(),mock),
  {status:503,code:'LIVEKIT_NOT_CONFIGURED'});
 assert.equal(count,0);
});
test('401, 403, 5xx, malformed JSON and network error are sanitized',async()=>{
 for(const status of [401,403,404,500,503]){
  const x=await checkLiveKitProvider(env,actor,Date.now(),
    async()=>new Response('private-provider-response',{status}));
  assert.deepEqual(x,{status:503,code:[401,403].includes(status)?
   'LIVEKIT_PROVIDER_AUTH_REJECTED':'LIVEKIT_PROVIDER_UNAVAILABLE'});
 }
 assert.deepEqual(await checkLiveKitProvider(env,actor,Date.now(),
   async()=>Response.json({rooms:'wrong-type'})),
  {status:503,code:'LIVEKIT_PROVIDER_UNAVAILABLE'});
 assert.deepEqual(await checkLiveKitProvider(env,actor,Date.now(),async()=>{throw Error('never expose secret');}),
  {status:503,code:'LIVEKIT_PROVIDER_UNAVAILABLE'});
});
