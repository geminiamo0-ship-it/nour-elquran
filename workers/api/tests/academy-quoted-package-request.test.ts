import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerPackageRequest} from '../src/academy-admin-mvp.ts';
import type {CoreDatabase} from '../src/bindings.ts';

const OWNER='synthetic-owner',LEARNER='synthetic_learner';
const PACKAGE='11111111-1111-4111-8111-111111111111';
const VERSION='22222222-2222-4222-8222-222222222222';
const OP='33333333-3333-4333-8333-333333333333';
const request={operationId:OP,packageId:PACKAGE,packageVersionId:VERSION};

function fixture(options:{owned?:boolean;prior?:Record<string,unknown>|null;
 priorAfterWrite?:Record<string,unknown>|null;writeError?:string;changes?:number}={}){
 const writes:Array<{sql:string;values:unknown[]}>=[],queries:string[]=[];
 let wrote=false;
 const db={
  prepare(sql:string){
   queries.push(sql);
   let values:unknown[]=[];
   return {
    bind(...args:unknown[]){values=args;return this;},
    async first(){
     if(sql.includes('FROM learners l JOIN accounts a'))
      return options.owned===false?null:{ok:1};
     if(sql.includes('FROM academy_request_events WHERE operation_id=?'))
      return wrote&&options.priorAfterWrite!==undefined?
       options.priorAfterWrite:options.prior??null;
     throw Error('Unexpected first SQL in quote test');
    },
    async run(){
     writes.push({sql,values});
     wrote=true;
     if(options.writeError)throw Error(options.writeError);
     return {success:true,meta:{changes:options.changes??1}};
    },
   };
  },
 } as unknown as CoreDatabase;
 return {db,writes,queries};
}

test('guardian POST requires exact immutable quote version before querying D1',async()=>{
 const f=fixture();
 assert.deepEqual(await ownerPackageRequest(f.db,OWNER,LEARNER,{
  operationId:OP,packageId:PACKAGE}),{status:400,code:'ACADEMY_INVALID_REQUEST'});
 assert.deepEqual(await ownerPackageRequest(f.db,OWNER,LEARNER,{
  ...request,packageVersionId:'not-a-uuid'}),{status:400,code:'ACADEMY_INVALID_REQUEST'});
 assert.deepEqual(await ownerPackageRequest(f.db,OWNER,LEARNER,{
  ...request,priceEgp:1}),{status:400,code:'ACADEMY_INVALID_REQUEST'});
 assert.equal(f.queries.length,0);
});

test('same-payload replay returns original quote even after catalog changes',async()=>{
 const prior={id:'44444444-4444-4444-8444-444444444444',
  learnerId:LEARNER,actor:OWNER,packageId:PACKAGE,packageVersionId:VERSION};
 const f=fixture({prior});
 assert.deepEqual(await ownerPackageRequest(f.db,OWNER,LEARNER,request),
  {status:200,code:'ACADEMY_REQUEST_REPLAY',academyRequestId:prior.id});
 assert.equal(f.writes.length,0);
 assert.deepEqual(await ownerPackageRequest(f.db,OWNER,LEARNER,{
  ...request,packageVersionId:'55555555-5555-4555-8555-555555555555'}),
  {status:409,code:'ACADEMY_OPERATION_CONFLICT'});
 assert.equal(f.writes.length,0);
});

test('one atomic SQL statement binds quoted version and rejects stale catalog',async()=>{
 const f=fixture({changes:0});
 assert.deepEqual(await ownerPackageRequest(f.db,OWNER,LEARNER,request),
  {status:409,code:'ACADEMY_PACKAGE_CHANGED'});
 assert.equal(f.writes.length,1);
 const {sql,values}=f.writes[0]!;
 assert.match(sql,/INSERT INTO academy_request_events/);
 assert.match(sql,/SELECT \?,\?,\?,\?,p\.package_id,p\.id/);
 assert.match(sql,/p\.id=\? AND p\.package_id=\? AND p\.active=1/);
 assert.match(sql,/NOT EXISTS\(SELECT 1 FROM academy_package_events newer/);
 assert.equal(values[5],VERSION);
 assert.equal(values[6],PACKAGE);
 const success=fixture();
 const accepted=await ownerPackageRequest(success.db,OWNER,LEARNER,request);
 if(accepted.status!==201)throw Error('Expected a created request');
 assert.equal(accepted.code,'ACADEMY_REQUEST_CREATED');
 assert.match(accepted.academyRequestId,/^[0-9a-f-]{36}$/);
});

test('foreign learner fails before replay or write, including a valid operationId',async()=>{
 const f=fixture({owned:false,prior:{id:'should-not-be-read'}});
 assert.deepEqual(await ownerPackageRequest(f.db,OWNER,LEARNER,request),
  {status:404,code:'NOT_FOUND'});
 assert.equal(f.queries.length,1);
 assert.equal(f.writes.length,0);
});

test('simultaneous same-operation INSERT loser recovers exact committed ACK',async()=>{
 const committed={id:'44444444-4444-4444-8444-444444444444',
  learnerId:LEARNER,actor:OWNER,packageId:PACKAGE,packageVersionId:VERSION};
 const f=fixture({writeError:'UNIQUE constraint failed: academy_request_events.operation_id',
  priorAfterWrite:committed});
 assert.deepEqual(await ownerPackageRequest(f.db,OWNER,LEARNER,request),
  {status:200,code:'ACADEMY_REQUEST_REPLAY',academyRequestId:committed.id});
 assert.equal(f.writes.length,1);
 assert.equal(f.queries.filter(sql=>sql.includes('FROM academy_request_events WHERE operation_id=?')).length,2);
});

test('concurrent conflicting operation never leaks the winner request ID',async()=>{
 const committed={id:'44444444-4444-4444-8444-444444444444',
  learnerId:LEARNER,actor:OWNER,packageId:PACKAGE,
  packageVersionId:'55555555-5555-4555-8555-555555555555'};
 const f=fixture({writeError:'UNIQUE constraint failed: academy_request_events.operation_id',
  priorAfterWrite:committed});
 assert.deepEqual(await ownerPackageRequest(f.db,OWNER,LEARNER,request),
  {status:409,code:'ACADEMY_OPERATION_CONFLICT'});
 const foreign=fixture({writeError:'UNIQUE constraint failed: academy_request_events.operation_id',
  priorAfterWrite:{...committed,actor:'another-owner',packageVersionId:VERSION}});
 assert.deepEqual(await ownerPackageRequest(foreign.db,OWNER,LEARNER,request),
  {status:409,code:'ACADEMY_OPERATION_CONFLICT'});
});

test('unrelated pending-request constraint still denies without claiming a replay',async()=>{
 const f=fixture({writeError:'ACADEMY_REQUEST_PENDING',priorAfterWrite:null});
 assert.deepEqual(await ownerPackageRequest(f.db,OWNER,LEARNER,request),
  {status:409,code:'ACADEMY_REQUEST_DENIED'});
 assert.equal(f.writes.length,1);
});
