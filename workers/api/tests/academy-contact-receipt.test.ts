import test from 'node:test';
import assert from 'node:assert/strict';
import {staffContact} from '../src/academy-admin-mvp.ts';
import type {CoreDatabase} from '../src/bindings.ts';

const STAFF='synthetic-staff';
const OP='11111111-1111-4111-8111-111111111111';
const command={operationId:OP,whatsappNumber:'201000000000'};
const saved={actor:STAFF,whatsappNumber:command.whatsappNumber};

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
     if(sql.includes('FROM academy_contact_events WHERE operation_id=?'))
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

test('contact update needs affirmative D1 receipt before success',async()=>{
 const ok=fixture();
 assert.deepEqual(await staffContact(ok.db,STAFF,command),
  {status:201,code:'ACADEMY_WHATSAPP_SAVED'});
 assert.equal(ok.writes.length,1);
 for(const receipt of [{success:false,meta:{changes:0}},
  {success:true,meta:{changes:0}}]){
  const f=fixture({receipt});
  assert.deepEqual(await staffContact(f.db,STAFF,command),
   {status:503,code:'ACADEMY_CONTACT_STORAGE_UNAVAILABLE'});
  assert.equal(f.writes.length,1);
 }
});

test('contact replay requires same staff actor and immutable number',async()=>{
 const exact=fixture({prior:saved});
 assert.deepEqual(await staffContact(exact.db,STAFF,command),
  {status:200,code:'ACADEMY_CONTACT_REPLAY'});
 assert.equal(exact.writes.length,0);
 for(const collision of [{...saved,actor:'different-staff'},
  {...saved,whatsappNumber:'201111111111'}]){
  const f=fixture({prior:collision});
  assert.deepEqual(await staffContact(f.db,STAFF,command),
   {status:409,code:'ACADEMY_OPERATION_CONFLICT'});
  assert.equal(f.writes.length,0);
 }
});

test('unknown contact write outcome reconciles only a committed exact receipt',async()=>{
 const recovered=fixture({writeError:'Transaction aborted',afterWrite:saved});
 assert.deepEqual(await staffContact(recovered.db,STAFF,command),
  {status:200,code:'ACADEMY_CONTACT_REPLAY'});
 const unknown=fixture({writeError:'Transaction aborted'});
 assert.deepEqual(await staffContact(unknown.db,STAFF,command),
  {status:503,code:'ACADEMY_CONTACT_STORAGE_UNAVAILABLE'});
 const failedReceipt=fixture({receipt:{success:false,meta:{changes:0}},afterWrite:saved});
 assert.deepEqual(await staffContact(failedReceipt.db,STAFF,command),
  {status:200,code:'ACADEMY_CONTACT_REPLAY'});
 const collision=fixture({writeError:'UNIQUE constraint failed: operation_id',
  afterWrite:{...saved,actor:'other-staff'}});
 assert.deepEqual(await staffContact(collision.db,STAFF,command),
  {status:409,code:'ACADEMY_OPERATION_CONFLICT'});
});

test('revoked staff cannot inspect contact receipt or mutate contact',async()=>{
 const f=fixture({authorized:false,prior:saved});
 assert.deepEqual(await staffContact(f.db,STAFF,command),
  {status:403,code:'STAFF_ACCESS_DENIED'});
 assert.equal(f.writes.length,0);
});
