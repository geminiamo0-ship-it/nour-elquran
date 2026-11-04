import test from 'node:test';
import assert from 'node:assert/strict';
import {staffReject} from '../src/academy-admin-mvp.ts';
import type {CoreDatabase} from '../src/bindings.ts';

const STAFF='synthetic-staff';
const REQUEST='11111111-1111-4111-8111-111111111111';
const OP='22222222-2222-4222-8222-222222222222';
const command={operationId:OP,requestId:REQUEST,reason:'Synthetic guardian request rejected'};
const saved={actor:STAFF,requestId:REQUEST,reason:command.reason};

function fixture(options:{authorized?:boolean;prior?:Record<string,unknown>|null;
 afterWrite?:Record<string,unknown>|null;writeError?:string;
 receipt?:{success:boolean;meta:{changes:number}}}={}){
 let attempted=false;
 const writes:string[]=[];
 const db={
  prepare(sql:string){
   return {
    bind(..._values:unknown[]){return this;},
    async first(){
     if(sql.includes('FROM staff_grants'))
      return options.authorized===false?null:{subject:STAFF};
     if(sql.includes('FROM academy_request_rejections WHERE operation_id=?'))
      return attempted&&options.afterWrite!==undefined?
       options.afterWrite:options.prior??null;
     throw Error('Unexpected synthetic D1 query');
    },
    async run(){
     attempted=true;writes.push(sql);
     if(options.writeError)throw Error(options.writeError);
     return options.receipt??{success:true,meta:{changes:1}};
    },
   };
  },
 } as unknown as CoreDatabase;
 return {db,writes};
}

test('rejection requires committed D1 receipt and never invents a saved decision',async()=>{
 const success=fixture();
 assert.deepEqual(await staffReject(success.db,STAFF,command),
  {status:201,code:'ACADEMY_REQUEST_REJECTED'});
 assert.equal(success.writes.length,1);
 for(const receipt of [{success:false,meta:{changes:0}},
  {success:true,meta:{changes:0}}]){
  const f=fixture({receipt});
  assert.deepEqual(await staffReject(f.db,STAFF,command),
   {status:503,code:'ACADEMY_REJECTION_STORAGE_UNAVAILABLE'});
  assert.equal(f.writes.length,1);
 }
});

test('exact rejection replay is safe; actor, request and reason collisions deny',async()=>{
 const f=fixture({prior:saved});
 assert.deepEqual(await staffReject(f.db,STAFF,command),
  {status:200,code:'ACADEMY_REQUEST_REJECTION_REPLAY'});
 assert.equal(f.writes.length,0);
 for(const collision of [{...saved,actor:'other-staff'},
  {...saved,requestId:'33333333-3333-4333-8333-333333333333'},
  {...saved,reason:'Different decision rationale'}]){
  const denied=fixture({prior:collision});
  assert.deepEqual(await staffReject(denied.db,STAFF,command),
   {status:409,code:'ACADEMY_OPERATION_CONFLICT'});
  assert.equal(denied.writes.length,0);
 }
});

test('lost ACK and D1 abort reconcile the original operation only',async()=>{
 const recovered=fixture({writeError:'Transaction aborted',afterWrite:saved});
 assert.deepEqual(await staffReject(recovered.db,STAFF,command),
  {status:200,code:'ACADEMY_REQUEST_REJECTION_REPLAY'});
 const unavailable=fixture({writeError:'Transaction aborted'});
 assert.deepEqual(await staffReject(unavailable.db,STAFF,command),
  {status:503,code:'ACADEMY_REJECTION_STORAGE_UNAVAILABLE'});
 const receipt=fixture({receipt:{success:false,meta:{changes:0}},afterWrite:saved});
 assert.deepEqual(await staffReject(receipt.db,STAFF,command),
  {status:200,code:'ACADEMY_REQUEST_REJECTION_REPLAY'});
 const raced=fixture({writeError:'UNIQUE constraint failed: operation_id',
  afterWrite:{...saved,reason:'Other reason'}});
 assert.deepEqual(await staffReject(raced.db,STAFF,command),
  {status:409,code:'ACADEMY_OPERATION_CONFLICT'});
});

test('revoked staff cannot read or write rejection operation receipts',async()=>{
 const f=fixture({authorized:false,prior:saved});
 assert.deepEqual(await staffReject(f.db,STAFF,command),
  {status:403,code:'STAFF_ACCESS_DENIED'});
 assert.equal(f.writes.length,0);
});
