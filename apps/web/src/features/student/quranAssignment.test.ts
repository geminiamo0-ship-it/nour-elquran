import { describe,expect,it } from 'vitest';
import { referencesForRange, rangeContains, nextBookedLesson,validAssignmentRange,VOLUNTARY_SAMPLES } from './quranAssignment';
import { DEMO_PROFILES,getMockLearnerSnapshot } from './mock-adapter';

describe('teacher approved training and official Quran scope',()=>{
  it('does not parse arbitrary Arabic strings as Quran assignments',()=>{
    expect(validAssignmentRange(undefined)).toBe(false);
    expect(validAssignmentRange({surah:1,fromAyah:3,toAyah:1,page:1})).toBe(false);
    expect(validAssignmentRange({surah:113,fromAyah:1,toAyah:5,page:604})).toBe(true);
    expect(referencesForRange({surah:113,fromAyah:1,toAyah:3,page:604}))
      .toEqual([{surah:113,ayah:1},{surah:113,ayah:2},{surah:113,ayah:3}]);
  });
  it('only focuses bounded verses inside the explicit assignment',()=>{
    const range=VOLUNTARY_SAMPLES[0]!.range;
    expect(rangeContains(range,{surah:112,ayah:4})).toBe(true);
    expect(rangeContains(range,{surah:112,ayah:5})).toBe(false);
    expect(rangeContains(range,{surah:113,ayah:1})).toBe(false);
  });
  it('keeps voluntary samples separate from teacher-approved mock tasks and sibling profiles',()=>{
    const active=getMockLearnerSnapshot(DEMO_PROFILES[1]!);
    const newLearner=getMockLearnerSnapshot(DEMO_PROFILES[0]!);
    expect(active.tasks).toHaveLength(2);
    expect(active.tasks.every(t=>t.quranRange&&validAssignmentRange(t.quranRange))).toBe(true);
    expect(newLearner.tasks).toHaveLength(0);
    expect(VOLUNTARY_SAMPLES.every(x=>validAssignmentRange(x.range))).toBe(true);
  });
  it('chooses only the nearest booked future lesson, never a completed lesson',()=>{
    expect(nextBookedLesson([{dayOffset:-1,status:'booked'},{dayOffset:4,status:'booked'},
      {dayOffset:0,status:'completed'},{dayOffset:2,status:'booked'}])?.dayOffset).toBe(2);
    expect(nextBookedLesson([{dayOffset:-1,status:'completed'}])).toBeNull();
  });
});
