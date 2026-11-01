import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {readOwnerSubscriptionLedger} from '../src/subscription-ledger.ts';
import type {CoreDatabase} from '../src/bindings.ts';

function fake(owned:boolean,cycle:unknown,comp:unknown){
 const queries:string[]=[];
 const db={
  prepare(sql:string){
   queries.push(sql);
   return {bind(...args:unknown[]){
    void args;
    return {async first(){
      if(sql.includes('FROM learners')&&sql.includes('auth_subject'))
       return owned?{allowed:1}:null;
      if(sql.includes('FROM subscription_cycles'))return cycle;
      if(sql.includes('FROM subscription_compensation_grants'))return comp;
      throw Error('unexpected read '+sql);
    }};
   }};
  },
 } as unknown as CoreDatabase;
 return {db,queries};
}
const ACTIVE=1_800_000_000_000;

test('signed owner sees precise non-bookable academic credit facts without money',async()=>{
 const {db,queries}=fake(true,{
  startsAtMs:ACTIVE,endsAtMs:ACTIVE+30*86400000,
  baseSessions:8,rolloverSessions:2,spentSessions:3,
 },{
  grantCount:3,totalSessions:4,spentSessions:1,
 });
 const result=await readOwnerSubscriptionLedger(db,'owner','child-a',ACTIVE+500);
 assert.equal(result.status,200);
 assert.equal(result.code,'SUBSCRIPTION_LEDGER');
 if(result.status!==200)throw Error('unexpected status');
 assert.equal(result.bookingEnabled,false);
 assert.equal(result.latestCycle?.recordedUnspentSessions,7);
 assert.equal(result.latestCycle?.state,'within_period');
 assert.equal(result.compensationUnspentSessions,3);
 assert.equal(result.compensationGrantCount,3);
 assert.equal(queries.length,3);
 assert.equal(JSON.stringify(result).includes('payment'),false);
});
test('no subscription is shown as purchased or paid',async()=>{
 const {db}=fake(true,null,{grantCount:0,totalSessions:0,spentSessions:0});
 const result=await readOwnerSubscriptionLedger(db,'owner','child-a',ACTIVE);
 assert.equal(result.status,200);
 if(result.status!==200)throw Error();
 assert.equal(result.latestCycle,null);
 assert.equal(result.compensationUnspentSessions,0);
 assert.equal(result.bookingEnabled,false);
});
test('foreign owner and invalid learner fail closed before consulting credits',async()=>{
 for(const learner of ['child-a','../staff']){
  const {db,queries}=fake(false,null,null);
  const result=await readOwnerSubscriptionLedger(db,'stranger',learner,ACTIVE);
  assert.deepEqual(result,{status:404,code:'NOT_FOUND'});
  assert.equal(queries.some(q=>q.includes('FROM subscription_cycles')),false);
 }
});
test('incorrect source counts fail closed instead of fabricating spendable credits',async()=>{
 const {db}=fake(true,{startsAtMs:ACTIVE,endsAtMs:ACTIVE+86400000,
  baseSessions:2,rolloverSessions:0,spentSessions:3},
  {grantCount:0,totalSessions:0,spentSessions:0});
 assert.deepEqual(await readOwnerSubscriptionLedger(db,'owner','child-a',ACTIVE),
 {status:503,code:'LEDGER_INCONSISTENT'});
});
