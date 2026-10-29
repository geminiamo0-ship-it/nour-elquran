import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parsePublishAssignment} from '../src/published-assignments.ts';
const correct={operationId:'48f455f7-65cf-4904-9bc3-fdfb7ba2f620',
 kind:'memorization',editionId:'hafs-kfqc:v1.1.1',surah:1,fromAyah:1,toAyah:7,
 dueAtMs:1799999999000,instructions:' حفظ سورة الفاتحة '};
test('teacher publishing contract uses Quran anchor identity and strict allowlist',()=>{
 assert.deepEqual(parsePublishAssignment(correct),{...correct,instructions:'حفظ سورة الفاتحة'});
 for(const bad of [
  {...correct,teacherId:'forged'},
  {...correct,learnerId:'forged'},
  {...correct,fromAyah:8},
  {...correct,surah:115},
  {...correct,kind:'danger'},
  {...correct,kind:['memorization']},
  {...correct,editionId:['hafs-kfqc:v1.1.1']},
  {...correct,operationId:[correct.operationId]},
  {...correct,editionId:'../../secret'},
  {...correct,dueAtMs:'tomorrow'},
  {...correct,operationId:'not-uuid'},
  {...correct,instructions:''},
  {...correct,instructions:'x'.repeat(501)},null,[],
 ])assert.equal(parsePublishAssignment(bad),null,JSON.stringify(bad));
});
