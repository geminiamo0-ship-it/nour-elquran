import {describe,it,expect} from 'vitest';
import {selectAuthorizedTeacherLearner,currentAuthorizedLearnerLessons} from './connected-teacher-roster';
import type {TeacherRosterRow,TeacherCalendarRow} from './teacher-read-api';

const roster:TeacherRosterRow[]=[
  {id:'learner-a',name:'أحمد',learnerType:'child'},
  {id:'learner-b',name:'عبد الله',learnerType:'adult'},
];
const lessons:TeacherCalendarRow[]=[
  {id:'lesson-a',learnerId:'learner-a',kind:'standard',status:'scheduled',startsAtMs:1,endsAtMs:2},
  {id:'lesson-b',learnerId:'learner-b',kind:'trial',status:'scheduled',startsAtMs:1,endsAtMs:2},
  {id:'lesson-c',learnerId:'learner-c',kind:'standard',status:'completed',startsAtMs:1,endsAtMs:2},
];
describe('teacher real roster derived selection',()=>{
 it('selects only from authoritative current roster and normalizes Arabic query',()=>{
  expect(selectAuthorizedTeacherLearner(roster,'', 'learner-b').selected?.id).toBe('learner-b');
  const searched=selectAuthorizedTeacherLearner(roster,'  عبد ', 'learner-a');
  expect(searched.shown.map(row=>row.id)).toEqual(['learner-b']);
  expect(searched.selected?.id).toBe('learner-b');
 });
 it('drops stale details and no longer shows revoked learner lessons',()=>{
  const current=selectAuthorizedTeacherLearner(roster.slice(0,1),'','learner-b');
  expect(current.selected?.id).toBe('learner-a');
  expect(currentAuthorizedLearnerLessons(current.selected,lessons).map(row=>row.id)).toEqual(['lesson-a']);
  expect(selectAuthorizedTeacherLearner([], '', 'learner-b').selected).toBeNull();
  expect(currentAuthorizedLearnerLessons(null,lessons)).toEqual([]);
 });
 it('search returning empty must not fall back to unrelated learner',()=>{
  const selected=selectAuthorizedTeacherLearner(roster,'لايوجد','learner-a');
  expect(selected.shown).toHaveLength(0);
  expect(selected.selected).toBeNull();
  expect(currentAuthorizedLearnerLessons(selected.selected,lessons)).toEqual([]);
 });
});
