import test from 'node:test';
import assert from 'node:assert/strict';
import {activationDeniedCode} from '../src/academy-admin-mvp.ts';

test('safe academy activation codes identify protected D1 business constraints',()=>{
 const cases:Record<string,string>={
 'D1_ERROR: SUBSCRIPTION_CYCLE_OVERLAP':'ACADEMY_CYCLE_OVERLAP',
 'D1_ERROR: SUBSCRIPTION_RENEWAL_CHAIN_INVALID':'ACADEMY_RENEWAL_CONFLICT',
 'D1_ERROR: SUBSCRIPTION_ROLLOVER_MISMATCH':'ACADEMY_ROLLOVER_CONFLICT',
 'D1_ERROR: ACADEMY_VERSION_DENIED':'ACADEMY_PACKAGE_VERSION_UNAVAILABLE',
 'D1_ERROR: ACADEMY_REQUEST_MISMATCH':'ACADEMY_REQUEST_MISMATCH',
 'D1_ERROR: ACADEMY_STAFF_DENIED':'ACADEMY_STAFF_ACCESS_CHANGED',
 'D1_ERROR: ACADEMY_LEARNER_DENIED':'ACADEMY_LEARNER_UNAVAILABLE',
 'D1_ERROR: FOREIGN KEY constraint failed':'ACADEMY_REFERENCE_UNAVAILABLE',
 'UNIQUE constraint failed: academy_subscription_activation_events.request_id':
  'ACADEMY_REQUEST_ALREADY_ACTIVATED',
 };
 for(const [error,expected] of Object.entries(cases))
  assert.equal(activationDeniedCode(new Error(error)),expected);
 assert.equal(activationDeniedCode(new Error('D1_ERROR: internal DB path and private data')),
  'ACADEMY_ACTIVATION_DENIED','Never leak D1 diagnostics to client');
});
