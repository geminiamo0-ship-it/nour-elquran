import test from 'node:test';
import assert from 'node:assert/strict';
import {staffInvite} from '../src/academy-admin-mvp.ts';
import type {CoreDatabase} from '../src/bindings.ts';

const STAFF='synthetic-staff';
const OP='44444444-4444-4444-8444-444444444444';
const NOW=1700000000000;
type Row={actor:string;tokenHash:string;expiresAtMs:number};
type Receipt={success:boolean;meta:{changes:number}};
function fixture(options:{authorized?:boolean;prior?:Row|null;
 persist?:boolean;writeError?:string;receipt?:Receipt;
 collision?:Row}={}){
 let row:Row|null=options.prior??null;
 const writes:Array<{sql:string;values:unknown[]}>=[],reads:string[]=[];
 const db={
  prepare(sql:string){
   let values:unknown[]=[];
   return {
    bind(...args:unknown[]){values=args;return this;},
    async first(){
     reads.push(sql);
     if(sql.includes('FROM staff_grants'))
      return options.authorized===false?null:{subject:STAFF};
     if(sql.includes('FROM academy_teacher_invites WHERE operation_id=?'))
      return row;
     throw Error('Unexpected synthetic D1 read');
    },
    async run(){
     writes.push({sql,values});
     if(options.collision)row=options.collision;
     else if(options.persist!==false)
      row={actor:String(values[3]),tokenHash:String(values[2]),
       expiresAtMs:Number(values[5])};
     if(options.writeError)throw Error(options.writeError);
     return options.receipt??{success:true,meta:{changes:1}};
    },
   };
  },
 } as unknown as CoreDatabase;
 return {db,writes,reads,getRow:()=>row};
}

test('one-use invitation token is disclosed only after verified D1 hash readback',async()=>{
 const f=fixture();
 const result=await staffInvite(f.db,STAFF,{operationId:OP},NOW);
 assert.equal(result.status,201);
 assert.equal(result.code,'ACADEMY_INVITE_ISSUED');
 assert.equal(f.writes.length,1);
 assert.match(f.writes[0]!.sql,/INSERT INTO academy_teacher_invites/);
 const token='token' in result?result.token:'';
 assert.equal(typeof token,'string');
 assert.match(token,/^[0-9a-f]{64}$/);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 const hex=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
 assert.equal(f.getRow()?.tokenHash,hex);
 assert.equal(f.getRow()?.expiresAtMs,NOW+7*86400000);
});

test('unproven invite INSERT never returns the one-time token',async()=>{
 for(const receipt of [
  {success:false,meta:{changes:0}},
  {success:true,meta:{changes:0}},
  {success:true,meta:{changes:1}},
 ]){
  const f=fixture({receipt,persist:false});
  const result=await staffInvite(f.db,STAFF,{operationId:OP},NOW);
  assert.deepEqual(result,{status:503,code:'ACADEMY_INVITE_STORAGE_UNAVAILABLE'});
  assert.equal(f.writes.length,1);
 }
 const noReceipt=fixture({receipt:{success:false,meta:{changes:0}}});
 const recovered=await staffInvite(noReceipt.db,STAFF,{operationId:OP},NOW);
 assert.equal(recovered.status,201);
 assert.equal('token' in recovered?typeof recovered.token:'missing','string');
});

test('lost D1 acknowledgement recovers only the same newly generated token',async()=>{
 const committed=fixture({writeError:'Transaction aborted'});
 const ok=await staffInvite(committed.db,STAFF,{operationId:OP},NOW);
 assert.equal(ok.status,201);
 assert.equal('token' in ok?typeof ok.token:'missing','string');
 const absent=fixture({writeError:'Transaction aborted',persist:false});
 assert.deepEqual(await staffInvite(absent.db,STAFF,{operationId:OP},NOW),
  {status:503,code:'ACADEMY_INVITE_STORAGE_UNAVAILABLE'});
 const collided=fixture({writeError:'UNIQUE constraint failed: operation_id',
  collision:{actor:'another-staff',tokenHash:'different-hash',expiresAtMs:NOW}});
 assert.deepEqual(await staffInvite(collided.db,STAFF,{operationId:OP},NOW),
  {status:409,code:'ACADEMY_INVITE_DENIED'});
});

test('existing operation and revoked staff never reveal invitation secret',async()=>{
 const prior=fixture({prior:{actor:STAFF,tokenHash:'hash',expiresAtMs:NOW}});
 assert.deepEqual(await staffInvite(prior.db,STAFF,{operationId:OP},NOW),
  {status:409,code:'ACADEMY_INVITE_ALREADY_ISSUED'});
 assert.equal(prior.writes.length,0);
 const denied=fixture({authorized:false});
 assert.deepEqual(await staffInvite(denied.db,STAFF,{operationId:OP},NOW),
  {status:403,code:'STAFF_ACCESS_DENIED'});
 assert.equal(denied.writes.length,0);
 assert.equal(denied.reads.some(sql=>sql.includes('academy_teacher_invites')),false);
});
