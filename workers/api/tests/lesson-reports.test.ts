import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseReportAction} from '../src/lesson-reports.ts';
const id='0996d89e-1e5b-4d33-9abe-79f255f553eb';
const draft={kind:'save',operationId:id,expectedRevision:0,scope:' الفاتحة ',
 strengths:'جيد',corrections:'',nextPlan:'مراجعة',
 memorization:0,recitation:10,tajweed:null};
test('three independent scores preserve zero and null',()=>{
 assert.deepEqual(parseReportAction(draft),{...draft,scope:'الفاتحة'});
 assert.deepEqual(parseReportAction({...draft,memorization:null,recitation:null}),{
  ...draft,scope:'الفاتحة',memorization:null,recitation:null});
});
test('reject any actor injection, coerced fields, malformed grades or publication payload',()=>{
 for(const value of [{...draft,teacherId:'forged'}, {...draft,memorization:11},
  {...draft,memorization:-1},{...draft,recitation:2.5},{...draft,recitation:'7'},
  {...draft,tajweed:undefined},{...draft,expectedRevision:0.5},
  {...draft,expectedRevision:'0'},{...draft,scope:'x'.repeat(701)},
  {...draft,scope:'hello\u0000'}, {...draft,operationId:['not-an-id']},
  {...draft,kind:'publish'}, {},[],null])
  assert.equal(parseReportAction(value),null,JSON.stringify(value));
 assert.deepEqual(parseReportAction({kind:'publish',operationId:id,expectedRevision:2}),
  {kind:'publish',operationId:id,expectedRevision:2});
});
