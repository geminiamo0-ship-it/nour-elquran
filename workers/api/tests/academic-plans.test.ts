import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parsePlanAction} from '../src/academic-plans.ts';
const command={operationId:'48f455f7-65cf-4904-9bc3-fdfb7ba2f620',expectedRevision:0,
 level:'beginner',nextWird:' الفاتحة ',revisionWird:' مراجعة الفاتحة ',focus:' تصحيح النطق '};
test('plan action parser rejects actor injection, missing revision and oversized text',()=>{
 assert.deepEqual(parsePlanAction(command),{...command,nextWird:'الفاتحة',
    revisionWird:'مراجعة الفاتحة',focus:'تصحيح النطق'});
 for(const body of [
  {...command,teacherId:'forged'},
  {...command,expectedRevision:-1},
  {...command,expectedRevision:0.5},
  {...command,level:'admin'},
  {...command,nextWird:''},
  {...command,focus:'x'.repeat(501)},
  {...command,operationId:'not-uuid'},
  {operationId:command.operationId}, null, [],
 ])assert.equal(parsePlanAction(body),null,JSON.stringify(body));
});
