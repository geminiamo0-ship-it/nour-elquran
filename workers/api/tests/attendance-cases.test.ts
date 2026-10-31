import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseIncident,parseAppeal,parseReview} from '../src/attendance-cases.ts';
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
