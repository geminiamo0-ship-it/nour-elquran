import test from 'node:test';
import assert from 'node:assert/strict';
import {staffActivate} from '../src/academy-admin-mvp.ts';
import type {CoreDatabase} from '../src/bindings.ts';

const STAFF='synthetic-staff';
const LEARNER='11111111-1111-4111-8111-111111111111';
const VERSION='22222222-2222-4222-8222-222222222222';
const PACKAGE='33333333-3333-4333-8333-333333333333';
const OP='44444444-4444-4444-8444-444444444444';
const NOW=1700000000000;
const command={operationId:OP,learnerId:LEARNER,packageVersionId:VERSION,
 requestId:null,note:'Operator verified offline payment',manualConfirmed:true};
const saved={actor:STAFF,learnerId:LEARNER,packageVersionId:VERSION,
 requestId:null,note:command.note};

function fixture(options:{authorized?:boolean;prior?:Record<string,unknown>|null;
 afterWrite?:Record<string,unknown>|null;writeError?:string;
 receipt?:{success:boolean;meta:{changes:number}}}={}){
 const writes:Array<{sql:string;values:unknown[]}>=[];
 let attempted=false;
 const db={
  prepare(sql:string){
   let values:unknown[]=[];
   return {
    bind(...args:unknown[]){values=args;return this;},
    async first(){
     if(sql.includes('FROM staff_grants'))
      return options.authorized===false?null:{subject:STAFF};
     if(sql.includes('FROM academy_subscription_activation_events WHERE operation_id=?'))
      return attempted&&options.afterWrite!==undefined?
       options.afterWrite:options.prior??null;
     if(sql.includes('FROM academy_package_events WHERE id=?'))
      return {id:VERSION,packageId:PACKAGE,active:1};
     if(sql.includes('FROM academy_package_events p'))
      return {id:VERSION,packageId:PACKAGE,active:1};
     if(sql.includes('FROM subscription_cycles c'))return null;
     throw Error('Unexpected synthetic D1 query');
    },
    async run(){
     attempted=true;writes.push({sql,values});
     if(options.writeError)throw Error(options.writeError);
     return options.receipt??{success:true,meta:{changes:1}};
    }
   };
  }
 } as unknown as CoreDatabase;
 return {db,writes};
}

test('staff activation requires affirmative one-row D1 receipt',async()=>{
 const success=fixture();
 const ok=await staffActivate(success.db,STAFF,command,NOW);
 assert.equal(ok.status,201);
 assert.equal(ok.code,'ACADEMY_SUBSCRIPTION_ACTIVATED');
 assert.equal(success.writes.length,1);
 assert.match(success.writes[0]!.sql,/INSERT INTO academy_subscription_activation_events/);
 // D1 may include the activation's AFTER INSERT subscription-cycle trigger
 // in meta.changes; a positive trigger-inclusive receipt is valid.
 const trigger=fixture({receipt:{success:true,meta:{changes:2}}});
 assert.equal((await staffActivate(trigger.db,STAFF,command,NOW)).status,201);
 for(const receipt of [
  {success:false,meta:{changes:0}},
  {success:true,meta:{changes:0}},
 ]){
  const f=fixture({receipt});
  assert.deepEqual(await staffActivate(f.db,STAFF,command,NOW),
   {status:503,code:'ACADEMY_ACTIVATION_STORAGE_UNAVAILABLE'});
  assert.equal(f.writes.length,1);
 }
});

test('replayed activation must match the immutable operator audit note',async()=>{
 const exact=fixture({prior:saved});
 assert.deepEqual(await staffActivate(exact.db,STAFF,command,NOW),
  {status:200,code:'ACADEMY_ACTIVATION_REPLAY'});
 assert.equal(exact.writes.length,0);
 for(const different of [
  {...saved,note:'Different offline payment evidence'},
  {...saved,actor:'other-synthetic-staff'},
  {...saved,learnerId:'55555555-5555-4555-8555-555555555555'},
 ]){
  const f=fixture({prior:different});
  assert.deepEqual(await staffActivate(f.db,STAFF,command,NOW),
   {status:409,code:'ACADEMY_OPERATION_CONFLICT'});
  assert.equal(f.writes.length,0);
 }
});

test('unknown D1 abort does not claim settlement; committed exact retry recovers',async()=>{
 const unavailable=fixture({writeError:'Transaction aborted'});
 assert.deepEqual(await staffActivate(unavailable.db,STAFF,command,NOW),
  {status:503,code:'ACADEMY_ACTIVATION_STORAGE_UNAVAILABLE'});
 const committed=fixture({writeError:'Transaction aborted',afterWrite:saved});
 assert.deepEqual(await staffActivate(committed.db,STAFF,command,NOW),
  {status:200,code:'ACADEMY_ACTIVATION_REPLAY'});
 const wrong=fixture({writeError:'UNIQUE constraint failed: operation_id',
  afterWrite:{...saved,note:'Different operator attestation'}});
 assert.deepEqual(await staffActivate(wrong.db,STAFF,command,NOW),
  {status:409,code:'ACADEMY_OPERATION_CONFLICT'});
});

test('failed receipt with committed operation recovers only the exact ACK',async()=>{
 const f=fixture({receipt:{success:false,meta:{changes:0}},afterWrite:saved});
 assert.deepEqual(await staffActivate(f.db,STAFF,command,NOW),
  {status:200,code:'ACADEMY_ACTIVATION_REPLAY'});
 const denied=fixture({authorized:false});
 assert.deepEqual(await staffActivate(denied.db,STAFF,command,NOW),
  {status:403,code:'STAFF_ACCESS_DENIED'});
 assert.equal(denied.writes.length,0);
});
