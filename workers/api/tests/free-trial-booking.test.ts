import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseTrialSlotCommand,parseTrialBookingCommand} from '../src/free-trial-booking.ts';

const operationId='6145a6fa-1d94-4994-91e7-5819692ba3b6';
const slotId='7145a6fa-1d94-4994-91e7-5819692ba3b6';
test('staff can only publish exact 40m future slot input; no browser-determined grant',()=>{
 const valid={operationId,teacherId:'teacher-id',startsAtMs:1800000000000};
 assert.deepEqual(parseTrialSlotCommand(valid),valid);
 for(const bad of [
  {...valid,actorSubject:'staff'},{...valid,status:'approved'},
  {...valid,endsAtMs:valid.startsAtMs+100000}, {...valid,learnerId:'forged'},
  {...valid,teacherId:'../etc'},{...valid,startsAtMs:'tomorrow'},
  {...valid,operationId:'not-uuid'},null,[]
 ])assert.equal(parseTrialSlotCommand(bad),null,JSON.stringify(bad));
});
test('guardian books only an immutable published slot id with UUID, never a Sheikh',()=>{
 const valid={operationId,slotId};
 assert.deepEqual(parseTrialBookingCommand(valid),valid);
 for(const bad of [
  {...valid,teacherId:'teacher-id'},{...valid,learnerId:'sibling'},
  {...valid,startsAtMs:1800000000000},{...valid,amount:0},
  {...valid,consumed:false},{...valid,slotId:'not-uuid'},
  {...valid,operationId:'not-uuid'}
 ])assert.equal(parseTrialBookingCommand(bad),null,JSON.stringify(bad));
});
