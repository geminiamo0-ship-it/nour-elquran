import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseIncident,parseAppeal,parseReview,listStaffAttendanceAppeals,reviewAttendanceAppeal} from '../src/attendance-cases.ts';
import type {CoreDatabase} from '../src/bindings.ts';
const op='6145a6fa-1d94-4994-91e7-5819692ba3b6',incidentId='7145a6fa-1d94-4994-91e7-5819692ba3b6';
const v={operationId:op,kind:'student_no_show',reason:'Learner did not join after the verified 15-minute wait'};
test('teacher incident never trusts caller role, learner or presence assertion',()=>{
 assert.deepEqual(parseIncident(v),v);
 for(const bad of [
  {...v,role:'admin'},{...v,learnerId:'other'},{...v,teacherPresent:true},
  {...v,kind:'bill_absence'},{...v,kind:'absent'},{...v,reason:'short'},
  {...v,operationId:'not-uuid'},{...v,reason:'x'.repeat(501)},
  null,[]
 ])assert.equal(parseIncident(bad),null);
});
test('owner appeal is exactly incident reference and 10-1000 reason; no file/actor',()=>{
 const appeal={operationId:op,incidentId,reason:'The learner was present before the lesson time.'};
 assert.deepEqual(parseAppeal(appeal),appeal);
 for(const bad of [
  {...appeal,actorSubject:'other'},{...appeal,file:'malware'},{...appeal,learnerId:'sibling'},
  {...appeal,incidentId:'bad'},{...appeal,reason:'short'},
 ])assert.equal(parseAppeal(bad),null);
});
test('staff decision cannot include debit, compensation or spoofed status',()=>{
 const d={operationId:op,appealId:incidentId,decision:'accepted',
  reason:'Staff reviewed the lesson evidence and accepted the appeal.'};
 assert.deepEqual(parseReview(d),d);
 for(const bad of [
  {...d,compensationCredits:1},{...d,debit:true},{...d,actorSubject:'admin'},
  {...d,decision:'charged'},{...d,reason:'short'},
 ])assert.equal(parseReview(bad),null);
});

test('unverified attendance reviewer is denied before reading or editing appeal records',async()=>{
 const queries:string[]=[];
 const db={prepare:(sql:string)=>{queries.push(sql);return {
  bind:()=>({first:async()=>null})};}} as unknown as CoreDatabase;
 const denial=await listStaffAttendanceAppeals(db,'staff-without-verification');
 assert.deepEqual(denial,{status:403,code:'STAFF_ACCESS_DENIED'});
 assert.equal(queries.length,1);
 assert.match(queries[0]??'',/phone_number_verified=1/);
 assert.match(queries[0]??'',/auth_users/);
 assert.doesNotMatch(queries[0]??'',/FROM attendance_appeal_events/);
 const deniedWrite=await reviewAttendanceAppeal(db,'staff-without-verification',{
  operationId:op,appealId:incidentId,decision:'accepted',
  reason:'Administrative attendance evidence reviewed and signed.'
 });
 assert.deepEqual(deniedWrite,{status:403,code:'STAFF_ACCESS_DENIED'});
 assert.equal(queries.length,2);
 assert(queries.every(query=>query.includes('phone_number_verified=1')));
});
