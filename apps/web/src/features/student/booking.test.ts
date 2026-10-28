import { describe,expect,it } from 'vitest';
import { isValidPreference,mayPreviewFirstTrial,maySelfReschedule,RESCHEDULE_CUTOFF_MS,TRIAL_DURATION_MIN,TRIAL_PRICE_EGP } from './booking';
describe('trial eligibility and scheduling contracts',()=>{
  it('trial is one 30-minute zero-cost preview only for new mock learner stage',()=>{
    expect(TRIAL_PRICE_EGP).toBe(0);
    expect(TRIAL_DURATION_MIN).toBe(30);
    expect(mayPreviewFirstTrial('new')).toBe(true);
    for (const status of ['trial_booked','assessed','active','lapsed'] as const)
      expect(mayPreviewFirstTrial(status)).toBe(false);
  });
  it('requires legitimate weekday and selectable time window',()=>{
    expect(isValidPreference({weekday:6,window:'evening'})).toBe(true);
    expect(isValidPreference({weekday:7,window:'morning'})).toBe(false);
    expect(isValidPreference({weekday:-1,window:'morning'})).toBe(false);
  });
  it('checks reschedule cutoff at exactly six hours for real confirmed ISO times',()=>{
    const start='2026-10-30T20:00:00Z';
    const ts=Date.parse(start);
    expect(RESCHEDULE_CUTOFF_MS).toBe(21600000);
    expect(maySelfReschedule(start,new Date(ts-RESCHEDULE_CUTOFF_MS).toISOString())).toBe(true);
    expect(maySelfReschedule(start,new Date(ts-RESCHEDULE_CUTOFF_MS+1).toISOString())).toBe(false);
    expect(maySelfReschedule('bad-time',new Date(ts).toISOString())).toBe(false);
  });
});
