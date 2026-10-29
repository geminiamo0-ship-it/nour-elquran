import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseLearnerProfileAction} from '../src/learner-profile-actions.ts';
const id='48f455f7-65cf-4904-9bc3-fdfb7ba2f620';
test('only explicit versioned actions with UUID v4 and allowlisted keys are accepted',()=>{
  assert.deepEqual(parseLearnerProfileAction({action:'rename',operationId:id,expectedRevision:1,name:'  Synthetic learner  '}),
    {action:'rename',operationId:id,expectedRevision:1,name:'Synthetic learner'});
  assert.deepEqual(parseLearnerProfileAction({action:'archive',operationId:id,expectedRevision:2}),
    {action:'archive',operationId:id,expectedRevision:2});
  for(const body of [
    {action:'archive',operationId:id,expectedRevision:2,accountId:'forged'},
    {action:'archive',operationId:'bad',expectedRevision:2},
    {action:'archive',operationId:id,expectedRevision:0},
    {action:'rename',operationId:id,expectedRevision:1,name:''},
    {action:'rename',operationId:id,expectedRevision:1,name:' '.repeat(51)},
    {action:'rename',operationId:id,expectedRevision:1,name:'ok',actor:'staff'},
    {action:'delete',operationId:id,expectedRevision:1},
    null,[],{},
  ])assert.equal(parseLearnerProfileAction(body),null,JSON.stringify(body));
});
