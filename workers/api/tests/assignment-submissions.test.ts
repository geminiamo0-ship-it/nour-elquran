import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseSubmission,parseReview} from '../src/assignment-submissions.ts';
const uuid='48f455f7-65cf-4904-9bc3-fdfb7ba2f620';
test('submission DTO: idempotent operation only; no untrusted owner or file IDs',()=>{
 assert.deepEqual(parseSubmission({operationId:uuid,note:' written note '}),{operationId:uuid,note:'written note'});
 for(const bad of [null,[],{operationId:'fake',note:''},{operationId:uuid,note:'x'.repeat(501)},
  {operationId:uuid,note:'ok',teacherId:'forged'},{operationId:uuid,note:null}])
  assert.equal(parseSubmission(bad),null);
});
test('teacher review requires explicit decision and text; rejects fake grade',()=>{
 assert.deepEqual(parseReview({operationId:uuid,submissionId:uuid,decision:'retry_requested',
 feedback:' Try again '}),{operationId:uuid,submissionId:uuid,decision:'retry_requested',feedback:'Try again'});
 for(const bad of [{operationId:uuid,submissionId:uuid,decision:'completed',feedback:'x'},
  {operationId:uuid,submissionId:uuid,decision:'accepted',feedback:''},
  {operationId:uuid,submissionId:uuid,decision:'accepted',feedback:'fine',score:10}])
  assert.equal(parseReview(bad),null);
});
