import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseTeacherAction,canManageTeachers,issueTeacherRoleAction,VERIFIED_STAFF_MANAGE_SQL} from '../src/staff-teachers.ts';
import type {CoreDatabase} from '../src/bindings.ts';

const valid={targetUserId:'teacher-subject',action:'provision',reason:'Documentation verified',
  operationId:'00000000-0000-4000-8000-000000000001'};
test('admin teacher role request uses strict 4-field allowlist and UUID',()=>{
  assert.deepEqual(parseTeacherAction(valid),valid);
  for(const bad of [
    {...valid,role:'staff'}, {...valid,actorAuthSubject:'staff'},
    {...valid,targetUserId:'other;DROP TABLE teachers'}, {...valid,reason:'a'},
    {...valid,operationId:'not-an-operation'}, {...valid,action:'roles.manage'},
    {...valid,targetUserId:123},null,[],
  ])assert.equal(parseTeacherAction(bad),null);
});
test('D1 verified staff subject used as only authorization query bind',async()=>{
  const calls:Array<{sql:string;params:unknown[]}>=[];
  const db={prepare:(sql:string)=>({bind:(...params:unknown[])=>{
    calls.push({sql,params});return {first:async()=>({subject:'verified-staff'})};
  }})} as unknown as CoreDatabase;
  assert.equal(await canManageTeachers(db,'verified-staff'),true);
  assert.equal(calls[0]?.sql,VERIFIED_STAFF_MANAGE_SQL);
  assert.deepEqual(calls[0]?.params,['verified-staff']);
  assert.match(VERIFIED_STAFF_MANAGE_SQL,/roles\.manage/);
  assert.match(VERIFIED_STAFF_MANAGE_SQL,/revoked_at_ms IS NULL/);
  assert.match(VERIFIED_STAFF_MANAGE_SQL,/phone_number_verified=1/);
});
test('unverified actor fails closed before database access and missing grant denies',async()=>{
  const never={prepare:()=>{throw Error('must not query');}} as unknown as CoreDatabase;
  assert.equal(await canManageTeachers(never,''),false);
  const denied={prepare:()=>({bind:()=>({first:async()=>null})})} as unknown as CoreDatabase;
  assert.equal(await canManageTeachers(denied,'random-user'),false);
});

test('atomic active-lesson trigger becomes 409 even through legacy teacher-actions',async()=>{
  const calls:string[]=[];
  const db={prepare:(sql:string)=>{
    calls.push(sql);
    return {bind:()=>({
      first:async()=>sql.includes('staff_grants')?{subject:'verified-staff'}:
        sql.includes('SELECT id FROM teachers')?{id:'teacher-1'}:null,
      run:async()=>{throw Error('D1_ERROR: active classes block teacher transition');},
    })};
  }} as unknown as CoreDatabase;
  const response=await issueTeacherRoleAction(db,'verified-staff',{
    targetUserId:'teacher-subject',action:'suspend',
    reason:'Scheduled lesson must remain staffed',
    operationId:'00000000-0000-4000-8000-000000000002',
  },1800000000000);
  assert.deepEqual(response,{status:409,code:'ACTIVE_CLASSES_BLOCK_TRANSITION'});
  assert.equal(calls.filter(sql=>sql.includes('INSERT INTO teacher_role_events')).length,1);
  // The failed INSERT has no committed event; no false success or replay.
  assert.equal(calls.filter(sql=>sql.includes('WHERE operation_id=?')).length,2);
});

test('unrelated D1 write failures are not silently reported as policy conflicts',async()=>{
  const db={prepare:(sql:string)=>({bind:()=>({
    first:async()=>sql.includes('staff_grants')?{subject:'verified-staff'}:
      sql.includes('SELECT id FROM teachers')?{id:'teacher-1'}:null,
    run:async()=>{throw Error('database connection unavailable');},
  })})} as unknown as CoreDatabase;
  await assert.rejects(issueTeacherRoleAction(db,'verified-staff',{
    targetUserId:'teacher-subject',action:'suspend',
    reason:'Scheduled lesson must remain staffed',
    operationId:'00000000-0000-4000-8000-000000000003',
  },1800000000000),/database connection unavailable/);
});
