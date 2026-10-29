import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseTeacherAction,canManageTeachers,VERIFIED_STAFF_MANAGE_SQL} from '../src/staff-teachers.ts';
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
