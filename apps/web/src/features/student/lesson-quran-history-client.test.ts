import {strict as assert} from 'node:assert';
import {test} from 'vitest';
import {parseLessonQuranHistory} from './lesson-quran-history-client';

const learner='learner-1',lesson='lesson-1';
const raw={code:'QURAN_LESSON_HISTORY',learnerId:learner,lessonId:lesson,
 asOfMs:4000,pages:[1,2],marks:[]};
const mark={itemId:'stroke-0001',page:1,kind:'pen',audience:'shared',visible:true,
 originType:'lesson',originId:lesson,authorRole:'learner',surah:null,ayah:null,
 payload:{color:'#abcdef',width:3,points:[{x:1,y:2},{x:3,y:4}]}};
test('strict owner-scoped historical index, page and marks',()=>{
 assert.deepEqual(parseLessonQuranHistory(raw,learner,lesson,null).pages,[1,2]);
 const page=parseLessonQuranHistory({...raw,marks:[mark]},learner,lesson,1);
 assert.equal(page.marks[0]?.itemId,'stroke-0001');
 assert.throws(()=>parseLessonQuranHistory(raw,'sibling-2',lesson,null));
 assert.throws(()=>parseLessonQuranHistory(raw,learner,'lesson-2',null));
 assert.throws(()=>parseLessonQuranHistory({...raw,pages:[1,1]},learner,lesson,null));
 assert.throws(()=>parseLessonQuranHistory({...raw,pages:[605]},learner,lesson,null));
 assert.throws(()=>parseLessonQuranHistory({...raw,marks:[mark]},learner,lesson,null));
 assert.throws(()=>parseLessonQuranHistory({...raw,marks:[mark]},learner,lesson,2));
 assert.throws(()=>parseLessonQuranHistory({...raw,marks:[{...mark,audience:'private'}]},learner,lesson,1));
 assert.throws(()=>parseLessonQuranHistory({...raw,marks:[{...mark,originType:'self_study'}]},learner,lesson,1));
 assert.throws(()=>parseLessonQuranHistory({...raw,asOfMs:'4000'},learner,lesson,1));
});
