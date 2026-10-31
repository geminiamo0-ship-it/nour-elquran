import {describe,it,expect} from 'vitest';
import {elapsedLessonLabel} from './lesson-elapsed';
describe('authoritative Sheikh Start elapsed clock',()=>{
 it('formats seconds/minutes/hours from confirmed D1 start',()=>{
  expect(elapsedLessonLabel(100000,100000)).toBe('00:00');
  expect(elapsedLessonLabel(100000,101999)).toBe('00:01');
  expect(elapsedLessonLabel(100000,140000)).toBe('00:40');
  expect(elapsedLessonLabel(100000,2500000)).toBe('40:00');
  expect(elapsedLessonLabel(100000,3700000)).toBe('01:00:00');
 });
 it('never invents a start timestamp or negative elapsed time',()=>{
  expect(elapsedLessonLabel(null,100000)).toBeNull();
  expect(elapsedLessonLabel(100001,100000)).toBeNull();
  expect(elapsedLessonLabel(-10,100000)).toBeNull();
  expect(elapsedLessonLabel(Number.NaN,100000)).toBeNull();
  expect(elapsedLessonLabel(100000,Infinity)).toBeNull();
 });
});
