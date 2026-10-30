import {describe,expect,it} from 'vitest';
import {parseNotebookLessons,parseNotebookNotes,NotebookApiError} from './notebook-client';
const lesson={id:'lesson-1',learnerId:'learner-1',status:'completed',
 kind:'standard',startsAtMs:1000,endsAtMs:2401000};
describe('signed notebook API DTOs',()=>{
 it('rejects corrupted learner lesson records',()=>{
  expect(parseNotebookLessons({lessons:[lesson]})).toEqual([lesson]);
  for(const row of [{...lesson,learnerId:['forged']},{...lesson,status:'unknown'},
   {...lesson,endsAtMs:1000},{...lesson,kind:'admin'}])
   expect(()=>parseNotebookLessons({lessons:[row]})).toThrow(NotebookApiError);
 });
 it('refuses corrupt, duplicate and unbounded private notes',()=>{
  const note={id:'note-1',body:'Private text',version:1,updatedAtMs:2000};
  expect(parseNotebookNotes({notes:[note]})).toEqual([note]);
  for(const data of [[note,note],[{...note,body:''}],[{...note,version:0}],
    [{...note,updatedAtMs:-1}],[{...note,body:'x'.repeat(501)}]])
   expect(()=>parseNotebookNotes({notes:data})).toThrow(NotebookApiError);
 });
});
