import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseTrialReschedule} from '../src/trial-rescheduling.ts';

const op='6145a6fa-1d94-4994-91e7-5819692ba3b6';
const old='7145a6fa-1d94-4994-91e7-5819692ba3b6';
const slot='8145a6fa-1d94-4994-91e7-5819692ba3b6';

test('trial reschedule is only three UUID fields; identity and price never trusted',()=>{
 const good={operationId:op,oldLessonId:old,slotId:slot};
 assert.deepEqual(parseTrialReschedule(good),good);
 for(const bad of [
  {...good,learnerId:'sibling'}, {...good,teacherId:'different'},
  {...good,amount:0},{...good,oldLessonId:'bad'},
  {...good,slotId:'not-a-uuid'},{...good,operationId:''},
  null,[],{},Object.create(null)
 ])assert.equal(parseTrialReschedule(bad),null);
});
