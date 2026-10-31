import {describe,expect,it} from 'vitest';
import {reducePreview,validPreview} from './ink-preview';
const sample={type:'ink-preview',source:'teacher',phase:'start',
 strokeId:'ink-preview-00001',page:35,seq:0,kind:'marker',
 color:'#e2604e',width:16,points:[{x:10,y:20}]};
describe('provisional peer strokes remain separate from canonical history',()=>{
 it('reconstructs strictly ordered deltas, then expires after End',()=>{
  expect(validPreview(sample)).toBe(true);
  const first=reducePreview([],{...sample,phase:'start'} as never,1000);
  expect(first[0]?.stroke.points).toHaveLength(1);
  const move={...sample,phase:'move',seq:1,points:[{x:20,y:22}]};
  expect(validPreview(move)).toBe(true);
  const second=reducePreview(first,move as never,1030);
  expect(second[0]?.stroke.points).toHaveLength(2);
  const ended=reducePreview(second,{...sample,phase:'end',seq:2,points:[]} as never,1060);
  expect(ended[0]!.seenAtMs).toBeLessThan(1060);
  expect(reducePreview(ended,{...sample,phase:'cancel',seq:3,points:[]} as never,4000)).toEqual([]);
 });
 it('drops gaps, impossible dimensions, forged source and persistence ACKs',()=>{
  const first=reducePreview([],{...sample} as never,1000);
  expect(reducePreview(first,{...sample,phase:'move',seq:9,
   points:[{x:20,y:22}]} as never,1030)).toHaveLength(0);
  for(const invalid of [
   {...sample,source:'admin'},
   {...sample,persistence:'saved'},
   {...sample,authorSubject:'forged'},
   {...sample,points:[{x:1001,y:0}]},
   {...sample,phase:'end',points:[{x:1,y:2}]},
  ])expect(validPreview(invalid)).toBe(false);
 });
});
