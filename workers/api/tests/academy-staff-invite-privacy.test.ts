import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import type {CoreDatabase} from '../src/bindings.ts';
import {staffAcademy} from '../src/academy-admin-mvp.ts';

/** #315: the staff roster needs invite status, never a private auth subject. */
function fixture(granted=true,claimed:0|1=1){
 const reads:string[]=[];
 const invite={
  id:'invite-synthetic',createdAtMs:1700000000000,
  expiresAtMs:1700600000000,claimedAtMs:claimed?1700001000000:null,
  teacherName:claimed?'Synthetic Sheikh':null,
  claimed,teacherId:claimed?'teacher-synthetic':null,
  // Deliberately inject a sensitive adapter field: the public DTO must
  // explicitly project its allowlist, not spread arbitrary D1 row keys.
  claimedSubject:'private-auth-subject-not-for-browser',
 };
 const db={
  prepare(sql:string){
   reads.push(sql);
   const statement={
    bind(..._args:unknown[]){return statement;},
    async first(){
     if(sql.includes('FROM staff_grants'))
      return granted?{subject:'synthetic-staff'}:null;
     if(sql.includes('FROM academy_contact_events'))return null;
     throw Error('Unexpected D1 first');
    },
    async all(){
     if(sql.includes('FROM academy_teacher_invites'))return {results:[invite]};
     if(sql.includes('FROM academy_package_events')||
        sql.includes('FROM academy_request_events'))return {results:[]};
     throw Error('Unexpected D1 all');
    },
   };
   return statement;
  },
 } as unknown as CoreDatabase;
 return {db,reads};
}

test('signed staff invite status uses only an allowlisted DTO, never auth subject',async()=>{
 for(const claimed of [0,1] as const){
  const {db,reads}=fixture(true,claimed);
  const result=await staffAcademy(db,'synthetic-staff');
  assert.equal(result.status,200);
  if(result.status!==200)throw Error('Unexpected staff denial');
  assert.deepEqual(result.invites,[{
   id:'invite-synthetic',createdAtMs:1700000000000,
   expiresAtMs:1700600000000,claimedAtMs:claimed?1700001000000:null,
   teacherName:claimed?'Synthetic Sheikh':null,claimed,
   teacherId:claimed?'teacher-synthetic':null,
  }]);
  assert.doesNotMatch(JSON.stringify(result),/claimedSubject|private-auth-subject/);
  const sql=reads.find(query=>query.includes('FROM academy_teacher_invites'));
  assert.ok(sql);
  assert.match(sql,/CASE WHEN inv.claimed_subject IS NULL THEN 0 ELSE 1 END AS claimed/);
  assert.doesNotMatch(sql,/AS claimedSubject/);
 }
});

test('revoked staff grant denies before reading invite or learner records',async()=>{
 const {db,reads}=fixture(false);
 assert.deepEqual(await staffAcademy(db,'synthetic-staff'),
  {status:403,code:'STAFF_ACCESS_DENIED'});
 assert.equal(reads.some(sql=>sql.includes('academy_teacher_invites')||
  sql.includes('academy_request_events')),false);
});
