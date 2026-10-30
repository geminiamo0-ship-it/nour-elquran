import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseNotebookAction} from '../src/notebook-notes.ts';
const id='cc3c10a9-36ce-47aa-97aa-d5b1fcf54d61';
const note='fe9c5e85-66af-47f2-8919-ec3e167a0cae';
const input={operationId:id,noteId:note,action:'put',expectedVersion:0,
 body:' مراجعة سورة الإخلاص '};
test('notebook actions are normalized and replayable',()=>{
 assert.deepEqual(parseNotebookAction(input),{...input,body:'مراجعة سورة الإخلاص'});
 assert.deepEqual(parseNotebookAction({...input,action:'hide',body:'',expectedVersion:1}),
   {...input,action:'hide',body:'',expectedVersion:1});
});
test('notebook rejects client actor injection, malformed IDs and invalid revisions',()=>{
 for(const x of [{...input,learnerId:'forged'},{...input,noteId:['array']},
  {...input,operationId:'bad'},{...input,body:' '},
  {...input,body:'x'.repeat(501)},{...input,body:'\u0000'},
  {...input,expectedVersion:-1},{...input,expectedVersion:0.5},
  {...input,expectedVersion:'0'},{...input,action:'hide',body:''},
  {...input,action:'hide'},null,[],{}]){
  assert.equal(parseNotebookAction(x),null,JSON.stringify(x));
 }
});
