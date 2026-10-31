import {describe,expect,it} from 'vitest';
import {moveTrainingPage,validTrainingPages} from './training-page-window';

describe('approved published homework page window',()=>{
 it('accepts one-page and real multi-page Quran spans',()=>{
  expect(validTrainingPages(1,1)).toBe(true);
  expect(validTrainingPages(1,12)).toBe(true);
  expect(validTrainingPages(600,604)).toBe(true);
 });
 it('navigates exact certified start/end and never escapes to another assignment',()=>{
  expect(moveTrainingPage(4,7,4,-1)).toBe(4);
  expect(moveTrainingPage(4,7,4,1)).toBe(5);
  expect(moveTrainingPage(4,7,6,1)).toBe(7);
  expect(moveTrainingPage(4,7,7,1)).toBe(7);
 });
 it('rejects corrupted range, page, NaN, decimals and out-of-book pages',()=>{
  for(const [start,end] of [[0,3],[6,5],[600,605],[NaN,5],[10.5,11],[1,Infinity]]){
   expect(validTrainingPages(start!,end!)).toBe(false);
   expect(()=>moveTrainingPage(start!,end!,start!,1)).toThrow('INVALID_TRAINING_PAGE');
  }
  expect(()=>moveTrainingPage(4,7,3,1)).toThrow('INVALID_TRAINING_PAGE');
  expect(()=>moveTrainingPage(4,7,8,-1)).toThrow('INVALID_TRAINING_PAGE');
  expect(()=>moveTrainingPage(4,7,4,0 as 1)).toThrow('INVALID_TRAINING_PAGE');
 });
});
