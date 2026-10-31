import {describe,expect,it} from 'vitest';
import {realtimePath,validLessonHint} from './useLessonRealtime';

describe('authenticated classroom hint transport',()=>{
 it('derives role-specific signed same-origin endpoint',()=>{
  expect(realtimePath({role:'teacher',lessonId:'lesson-35'}))
   .toBe('/v1/teacher/lessons/lesson-35/realtime');
  expect(realtimePath({role:'learner',lessonId:'lesson-35',learnerId:'child-a'}))
   .toBe('/v1/me/learners/child-a/lessons/lesson-35/realtime');
 });
 it('ignores forged or uncommitted content and accepts only bounded revision hints',()=>{
  expect(validLessonHint({type:'quran-page',page:35,revision:123})).toBe(true);
  expect(validLessonHint({type:'quran-ink',page:1,revision:0})).toBe(true);
  expect(validLessonHint({type:'corrections',page:35,revision:1})).toBe(true);
  expect(validLessonHint({type:'presence',page:1,revision:2})).toBe(true);
  for(const bad of [
   {type:'quran-page',page:605,revision:2},
   {type:'quran-ink',page:1,revision:2,strokes:[]},
   {type:'quran-ink',page:1,revision:2,persistence:'saved'},
   {type:'quran-ink',page:1,revision:2,actorSubject:'forged'},
   {type:'corrections',page:1,revision:1,privateText:'forbidden'},
   {type:'presence',page:1,revision:1,participantId:'forged'},
   {type:'quran-ink',page:0,revision:2},
   {type:'quran-ink',page:1,revision:1.2},
   {type:'quran-ink',page:1,revision:-1},
  ])expect(validLessonHint(bad)).toBe(false);
 });
});
