import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {readStaffCapabilities,VERIFIED_STAFF_CAPABILITIES_SQL} from '../src/staff-capabilities.ts';
import type {CoreDatabase} from '../src/bindings.ts';

function fake(permissions:string[]){
 const binds:unknown[][]=[];
 const db={prepare:(sql:string)=>{
  assert.equal(sql,VERIFIED_STAFF_CAPABILITIES_SQL);
  return {bind:(...values:unknown[])=>{
   binds.push(values);
   return {all:async()=>({results:permissions.map(permission=>({permission}))})};
  }};
 }} as unknown as CoreDatabase;
 return {db,binds};
}
test('staff discovery uses verified D1 subject and active grants',async()=>{
 const {db,binds}=fake(['roles.manage','attendance.review']);
 assert.deepEqual(await readStaffCapabilities(db,'verified-staff'),{
  status:200,code:'STAFF_CAPABILITIES',
  permissions:{manageTeachers:true,reviewAttendance:true},
 });
 assert.deepEqual(binds,[['verified-staff']]);
 for(const clause of ['auth_users','phone_number_verified=1',
  "a.status='active'","g.revoked_at_ms IS NULL","g.auth_subject=?"])
  assert.ok(VERIFIED_STAFF_CAPABILITIES_SQL.includes(clause),clause);
});
test('role scoping, no grant and invalid actor fail closed',async()=>{
 assert.deepEqual(await readStaffCapabilities(fake(['roles.manage']).db,'staff-1'),{
  status:200,code:'STAFF_CAPABILITIES',
  permissions:{manageTeachers:true,reviewAttendance:false},
 });
 assert.deepEqual(await readStaffCapabilities(fake(['attendance.review']).db,'staff-2'),{
  status:200,code:'STAFF_CAPABILITIES',
  permissions:{manageTeachers:false,reviewAttendance:true},
 });
 assert.deepEqual(await readStaffCapabilities(fake([]).db,'owner'),{
  status:403,code:'STAFF_ACCESS_DENIED',
 });
 const never={prepare:()=>{throw Error('invalid subject must not reach DB');}} as unknown as CoreDatabase;
 for(const subject of ['', '../staff','invalid subject'])
  assert.deepEqual(await readStaffCapabilities(never,subject),{
   status:403,code:'STAFF_ACCESS_DENIED',
  });
});
