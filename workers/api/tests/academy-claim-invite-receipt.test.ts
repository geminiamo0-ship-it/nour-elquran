import test from 'node:test';
import assert from 'node:assert/strict';
import {claimInvite} from '../src/academy-admin-mvp.ts';
import type {CoreDatabase} from '../src/bindings.ts';

const TOKEN='a'.repeat(64);
const SUBJECT='synthetic-sheikh';
const OTHER='another-synthetic-sheikh';
const NOW=1700000000000;

function fixture(options:{
 initialClaim?:string|null;
 afterWrite?:'self'|'other'|'none';
 writeError?:string;
 receipt?:{success:boolean;meta:{changes:number}};
 expired?:boolean;
}={}){
 let claimed=options.initialClaim??null;
 let writes=0;
 const db={
  prepare(sql:string){
   let values:unknown[]=[];
   return {
    bind(...args:unknown[]){values=args;return this;},
    async first(){
     if(sql.includes('FROM academy_teacher_invites WHERE token_hash=?'))
      return {id:'synthetic-invite',claimedSubject:claimed,
       expiresAtMs:NOW+(options.expired?-1:86400000)};
     if(sql.includes('FROM academy_teacher_invites WHERE id=?'))
      return {claimedSubject:claimed};
     throw Error('Unexpected synthetic D1 read');
    },
    async run(){
     assert.match(sql,/UPDATE academy_teacher_invites/);
     assert.deepEqual(values,[SUBJECT,NOW,'synthetic-invite',NOW]);
     writes++;
     if(options.afterWrite==='self'||options.afterWrite===undefined)
      claimed=SUBJECT;
     if(options.afterWrite==='other')claimed=OTHER;
     if(options.writeError)throw Error(options.writeError);
     return options.receipt??{success:true,meta:{changes:2}};
    },
   };
  },
 } as unknown as CoreDatabase;
 return {db,getClaim:()=>claimed,getWrites:()=>writes};
}

test('claim requires durable same-subject readback after D1 trigger write',async()=>{
 const f=fixture();
 assert.deepEqual(await claimInvite(f.db,SUBJECT,{token:TOKEN},NOW),
  {status:201,code:'ACADEMY_INVITE_CLAIMED'});
 assert.equal(f.getClaim(),SUBJECT);
 assert.equal(f.getWrites(),1);
 const replay=fixture({initialClaim:SUBJECT});
 assert.deepEqual(await claimInvite(replay.db,SUBJECT,{token:TOKEN},NOW),
  {status:200,code:'ACADEMY_INVITE_CLAIMED'});
 assert.equal(replay.getWrites(),0);
});

test('lost D1 ACK after committed invite claim returns recovered success, not denial',async()=>{
 const f=fixture({writeError:'Transaction aborted',afterWrite:'self'});
 assert.deepEqual(await claimInvite(f.db,SUBJECT,{token:TOKEN},NOW),
  {status:200,code:'ACADEMY_INVITE_CLAIMED'});
 assert.equal(f.getClaim(),SUBJECT);
});

test('uncommitted abort or zero-change receipt stays retryable, never claims success',async()=>{
 const aborted=fixture({writeError:'Transaction aborted',afterWrite:'none'});
 assert.deepEqual(await claimInvite(aborted.db,SUBJECT,{token:TOKEN},NOW),
  {status:503,code:'ACADEMY_INVITE_STORAGE_UNAVAILABLE'});
 const unchanged=fixture({afterWrite:'none',receipt:{success:true,meta:{changes:0}}});
 assert.deepEqual(await claimInvite(unchanged.db,SUBJECT,{token:TOKEN},NOW),
  {status:503,code:'ACADEMY_INVITE_STORAGE_UNAVAILABLE'});
});

test('D1 receipt metadata cannot override a verified invite claimant',async()=>{
 const f=fixture({receipt:{success:false,meta:{changes:0}}});
 assert.deepEqual(await claimInvite(f.db,SUBJECT,{token:TOKEN},NOW),
  {status:200,code:'ACADEMY_INVITE_CLAIMED'});
});

test('raced foreign claimant, expired invite and invalid token fail closed',async()=>{
 const other=fixture({afterWrite:'other',writeError:'UNIQUE constraint failed'});
 assert.deepEqual(await claimInvite(other.db,SUBJECT,{token:TOKEN},NOW),
  {status:409,code:'ACADEMY_INVITE_USED'});
 const expired=fixture({expired:true});
 assert.deepEqual(await claimInvite(expired.db,SUBJECT,{token:TOKEN},NOW),
  {status:404,code:'ACADEMY_INVITE_NOT_FOUND'});
 assert.equal(expired.getWrites(),0);
 const invalid=fixture();
 assert.deepEqual(await claimInvite(invalid.db,SUBJECT,{token:'invalid'},NOW),
  {status:400,code:'ACADEMY_INVALID_INVITE'});
 assert.equal(invalid.getWrites(),0);
});
