import {describe,expect,it} from 'vitest';
import type {LessonRow} from '../shared';
import {nextVerifiedPreparationLesson} from './connected-training-preparation';

const child='child-a';
const lesson=(id:string,learnerId:string,status:LessonRow['status'],
 startsAtMs:number,endsAtMs=startsAtMs+2400000):LessonRow=>({
 id,learnerId,status,kind:'standard',startsAtMs,endsAtMs
});
describe('connected student preparation must use signed exact-child lessons',()=>{
 const now=1800000000000;
 it('selects nearest current real lesson instead of stale, cancelled or completed',()=>{
  const previous=lesson('old',child,'completed',now-7200000);
  const future=lesson('future',child,'scheduled',now+18000000);
  const soon=lesson('soon',child,'scheduled',now+3600000);
  const cancelled=lesson('cancel',child,'cancelled',now+100000);
  expect(nextVerifiedPreparationLesson([previous,future,cancelled,soon],child,now)?.id).toBe('soon');
 });
 it('retains a verified live lesson even if it started in the past',()=>{
  expect(nextVerifiedPreparationLesson([
   lesson('scheduled',child,'scheduled',now+3600000),
   lesson('ongoing',child,'live',now-100000,now+500000)
  ],child,now)?.id).toBe('ongoing');
 });
 it('returns null only when authoritative list contains no upcoming lessons',()=>{
  expect(nextVerifiedPreparationLesson([],child,now)).toBeNull();
  expect(nextVerifiedPreparationLesson([lesson('ended',child,'live',now-8000000,now-1000)],child,now)).toBeNull();
 });
 it('rejects cross-sibling rows instead of showing another learner schedule',()=>{
  expect(()=>nextVerifiedPreparationLesson([
    lesson('valid',child,'scheduled',now+1000),
    lesson('wrong','child-b','scheduled',now+2000)
  ],child,now)).toThrow('INVALID_OWNER_LESSONS');
 });
 it('rejects invalid profile or non-finite clock',()=>{
  expect(()=>nextVerifiedPreparationLesson([],'../other',now)).toThrow('INVALID_OWNER_LESSONS');
  expect(()=>nextVerifiedPreparationLesson([],child,Number.NaN)).toThrow('INVALID_OWNER_LESSONS');
 });
});
