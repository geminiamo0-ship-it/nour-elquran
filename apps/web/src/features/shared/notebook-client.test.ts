import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseNotebookLessons,parseNotebookNotes,NotebookApiError} from './notebook-client';
const lesson={id:'lesson-1',learnerId:'learner-1',status:'completed',
 kind:'standard',startsAtMs:1000,endsAtMs:2401000};
test('connected notebook calendar never trusts malformed client lesson rows',()=>{
 assert.deepEqual(parseNotebookLessons({lessons:[lesson]}),[lesson]);
 for(const row of [{...lesson,learnerId:['forged']},{...lesson,status:'unknown'},
  {...lesson,endsAtMs:1000},{...lesson,kind:'admin'}])
  assert.throws(()=>parseNotebookLessons({lessons:[row]}),NotebookApiError);
});
test('private notes reject corrupted, duplicate and out-of-bounds payloads',()=>{
 const note={id:'note-1',body:'Private text',version:1,updatedAtMs:2000};
 assert.deepEqual(parseNotebookNotes({notes:[note]}),[note]);
 for(const data of [[note,note],[{...note,body:''}],[{...note,version:0}],
   [{...note,updatedAtMs:-1}],[{...note,body:'x'.repeat(501)}]])
  assert.throws(()=>parseNotebookNotes({notes:data}),NotebookApiError);
});
