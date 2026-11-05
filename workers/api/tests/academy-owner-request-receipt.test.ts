import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerPackageRequest} from '../src/academy-admin-mvp.ts';
import type {CoreDatabase} from '../src/bindings.ts';

const OWNER='synthetic-owner';
const LEARNER='11111111-1111-4111-8111-111111111111';
const PACKAGE='22222222-2222-4222-8222-222222222222';
const VERSION='33333333-3333-4333-8333-333333333333';
const OP='44444444-4444-4444-8444-444444444444';
const SAVED_ID='55555555-5555-4555-8555-555555555555';
const command={operationId:OP,packageId:PACKAGE};
type Saved={id:string;learnerId:string;actor:string;packageId:string};
const saved:Saved={id:SAVED_ID,learnerId:LEARNER,actor:OWNER,packageId:PACKAGE};

function fixture(options:{owner?:boolean;active?:boolean;existing?:Saved|null;
 raced?:Saved|null;writeError?:string;
 writeResult?:{success:boolean;meta:{changes:number}}}={}){
 let writes=0;
 const db={
  prepare(sql:string){
   return {
    bind(..._values:unknown[]){return this;},
    async first(){
     if(sql.includes('FROM learners l JOIN accounts a'))
      return options.owner===false?null:{ok:1};
     if(sql.includes('FROM academy_request_events WHERE operation_id=?'))
      return writes>0&&options.raced!==undefined?options.raced:options.existing??null;
     if(sql.includes('FROM academy_package_events p'))
      return options.active===false?null:{id:VERSION,packageId:PACKAGE,active:1};
     throw Error('Unexpected synthetic D1 query');
    },
    async run(){
     writes++;
     if(options.writeError)throw Error(options.writeError);
     return options.writeResult??{success:true,meta:{changes:1}};
    },
   };
  },
 } as unknown as CoreDatabase;
 return {db,get writes(){return writes;}};
}

test('confirmed D1 owner request returns the new immutable request ID',async()=>{
 const f=fixture();
 const response=await ownerPackageRequest(f.db,OWNER,LEARNER,command);
 assert.equal(response.status,201);
 if(response.code!=='ACADEMY_REQUEST_CREATED')
  assert.fail('Confirmed D1 request must return the created receipt');
 assert.match(response.academyRequestId,/^[0-9a-f-]{36}$/i);
 assert.equal(f.writes,1);
});

test('resolved D1 write with no durable receipt never claims package request success',async()=>{
 for(const writeResult of [
  {success:false,meta:{changes:0}},
  {success:true,meta:{changes:0}},
 ]){
  const f=fixture({writeResult});
  assert.deepEqual(await ownerPackageRequest(f.db,OWNER,LEARNER,command),
   {status:503,code:'ACADEMY_REQUEST_STORAGE_UNAVAILABLE'});
  assert.equal(f.writes,1);
 }
});

test('same operation replays the original request, but never another actor or learner',async()=>{
 for(const collision of [
  saved,{...saved,actor:'synthetic-foreign-owner'},
  {...saved,learnerId:'66666666-6666-4666-8666-666666666666'},
  {...saved,packageId:'77777777-7777-4777-8777-777777777777'},
 ]){
  const f=fixture({existing:collision});
  const result=await ownerPackageRequest(f.db,OWNER,LEARNER,command);
  if(collision===saved)
   assert.deepEqual(result,{status:200,code:'ACADEMY_REQUEST_REPLAY',academyRequestId:SAVED_ID});
  else assert.deepEqual(result,{status:409,code:'ACADEMY_OPERATION_CONFLICT'});
  assert.equal(f.writes,0);
 }
});

test('lost acknowledgement or duplicate D1 operation recovers only the exact prior request',async()=>{
 for(const writeError of ['UNIQUE constraint failed: academy_request_events.operation_id',
  'Transaction aborted']){
  const f=fixture({writeError,raced:saved});
  assert.deepEqual(await ownerPackageRequest(f.db,OWNER,LEARNER,command),
   {status:200,code:'ACADEMY_REQUEST_REPLAY',academyRequestId:SAVED_ID});
  assert.equal(f.writes,1);
 }
 const wrong=fixture({writeError:'UNIQUE constraint failed',raced:{...saved,actor:'other'}});
 assert.deepEqual(await ownerPackageRequest(wrong.db,OWNER,LEARNER,command),
  {status:409,code:'ACADEMY_OPERATION_CONFLICT'});
});

test('ambiguous abort is unavailable, known constraint is denied, D1 outage propagates',async()=>{
 for(const writeError of ['D1_ERROR: request aborted','Transaction aborted']){
  const f=fixture({writeError});
  assert.deepEqual(await ownerPackageRequest(f.db,OWNER,LEARNER,command),
   {status:503,code:'ACADEMY_REQUEST_STORAGE_UNAVAILABLE'});
 }
 const denied=fixture({writeError:'ACADEMY_VERSION_DENIED'});
 assert.deepEqual(await ownerPackageRequest(denied.db,OWNER,LEARNER,command),
  {status:409,code:'ACADEMY_REQUEST_DENIED'});
 const outage=fixture({writeError:'D1_ERROR: database unavailable'});
 await assert.rejects(ownerPackageRequest(outage.db,OWNER,LEARNER,command),
  /D1_ERROR: database unavailable/);
});

test('foreign learner and unavailable catalog do not write a request',async()=>{
 const foreign=fixture({owner:false});
 assert.deepEqual(await ownerPackageRequest(foreign.db,OWNER,LEARNER,command),
  {status:404,code:'NOT_FOUND'});
 assert.equal(foreign.writes,0);
 const unavailable=fixture({active:false});
 assert.deepEqual(await ownerPackageRequest(unavailable.db,OWNER,LEARNER,command),
  {status:409,code:'ACADEMY_PACKAGE_UNAVAILABLE'});
 assert.equal(unavailable.writes,0);
});
