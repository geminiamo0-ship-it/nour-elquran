import {strict as assert} from 'node:assert';
import {test,vi} from 'vitest';
import {getSignedSubscriptionLedger,parseSubscriptionLedger} from './subscription-ledger-client';

const empty={code:'SUBSCRIPTION_LEDGER',bookingEnabled:false,
 latestCycle:null,compensationUnspentSessions:0,compensationGrantCount:0};
const recorded={...empty,latestCycle:{
 startsAtMs:1800000000000,endsAtMs:1802592000000,
 baseSessions:8,rolloverSessions:2,spentSessions:3,
 recordedUnspentSessions:7,state:'within_period',
}};
test('parse D1 academic ledger counts without asserting financial activation',()=>{
 assert.deepEqual(parseSubscriptionLedger(empty),empty);
 assert.deepEqual(parseSubscriptionLedger(recorded),recorded);
 for(const raw of [
  {...empty,bookingEnabled:true},{...empty,bookingEnabled:'false'},
  {...empty,compensationUnspentSessions:-1},
  {...empty,compensationUnspentSessions:'0'},
  {...empty,latestCycle:{...recorded.latestCycle,spentSessions:11}},
  {...empty,latestCycle:{...recorded.latestCycle,recordedUnspentSessions:8}},
  {...empty,latestCycle:{...recorded.latestCycle,endsAtMs:0}},
  {...empty,latestCycle:{...recorded.latestCycle,state:'paid'}},
  {bookingEnabled:false,latestCycle:null},
  null,[],{},Object.create(null),
 ])assert.throws(()=>parseSubscriptionLedger(raw));
});
test('owner GET uses only same-origin cookies, no store and no price data',async()=>{
 const previous=globalThis.fetch;
 const queries:string[]=[];
 vi.stubGlobal('fetch',async(input:string,init:RequestInit)=>{
  queries.push(input);
  assert.deepEqual(init.method,'GET');
  assert.deepEqual(init.credentials,'same-origin');
  assert.deepEqual(init.cache,'no-store');
  assert.deepEqual(init.redirect,'error');
  return new Response(JSON.stringify(empty),{status:200});
 });
 try{
  const data=await getSignedSubscriptionLedger('learner-1');
  assert.equal(data.bookingEnabled,false);
  assert.deepEqual(queries,['/v1/me/learners/learner-1/subscription-ledger']);
 }finally{vi.stubGlobal('fetch',previous);vi.unstubAllGlobals();}
});
test('server faults, denied users, malformed and fake credits never become zero fallback',async()=>{
 const prev=globalThis.fetch;
 try{
  vi.stubGlobal('fetch',async()=>new Response('{"code":"NOT_FOUND"}',{status:404}));
  await assert.rejects(()=>getSignedSubscriptionLedger('other-learner'));
  vi.stubGlobal('fetch',async()=>new Response('{not-json',{status:200}));
  await assert.rejects(()=>getSignedSubscriptionLedger('learner-1'));
  vi.stubGlobal('fetch',async()=>new Response(
   JSON.stringify({...empty,bookingEnabled:true}),{status:200}));
  await assert.rejects(()=>getSignedSubscriptionLedger('learner-1'));
  await assert.rejects(()=>getSignedSubscriptionLedger('../staff'));
 }finally{vi.stubGlobal('fetch',prev);vi.unstubAllGlobals();}
});
