import { describe, expect, it } from 'vitest';
import {
  CHANGE_CUTOFF_MS, TRIAL_DURATION_MINUTES, canRequestChange, changeDeadline,
  getMockTrialPreviewSlots, isValidTrialPreviewSlot, trialPreviewEligibility,
} from './trialScheduling';

describe('S03 illustrative trial scheduling domain', () => {
  const now = new Date('2026-10-28T12:00:00.000Z');
  it('offers only explicitly illustrative 30-minute UTC choices, scoped to a learner', () => {
    const slots = getMockTrialPreviewSlots('learner-a', now);
    expect(slots).toHaveLength(3);
    expect(slots.every((slot) => slot.durationMinutes === TRIAL_DURATION_MINUTES
      && slot.source === 'illustration' && isValidTrialPreviewSlot(slot, 'learner-a', now))).toBe(true);
    expect(slots.some((slot) => isValidTrialPreviewSlot(slot, 'learner-b', now))).toBe(false);
    expect(getMockTrialPreviewSlots('learner-b', now).every((slot) => slot.learnerId === 'learner-b')).toBe(true);
  });
  it('rejects invalid dates, stale slots, forged availability and altered duration', () => {
    const slot = getMockTrialPreviewSlots('a', now)[0]!;
    expect(isValidTrialPreviewSlot({ ...slot, durationMinutes: 60 }, 'a', now)).toBe(false);
    expect(isValidTrialPreviewSlot({ ...slot, source: 'confirmed' }, 'a', now)).toBe(false);
    expect(isValidTrialPreviewSlot({ ...slot, startsAt: '2026-02-30T12:00:00.000Z' }, 'a', now)).toBe(false);
    expect(isValidTrialPreviewSlot(slot, 'a', new Date(slot.startsAt))).toBe(false);
    expect(getMockTrialPreviewSlots('a', new Date('invalid'))).toEqual([]);
  });
  it('enforces the inclusive exact six-hour change boundary in UTC', () => {
    const startsAt = '2026-10-29T16:00:00.000Z';
    const cutoff = new Date(Date.parse(startsAt) - CHANGE_CUTOFF_MS);
    expect(canRequestChange(startsAt, new Date(cutoff.getTime() - 1))).toBe(true);
    expect(canRequestChange(startsAt, cutoff)).toBe(true);
    expect(canRequestChange(startsAt, new Date(cutoff.getTime() + 1))).toBe(false);
    expect(changeDeadline(startsAt)?.toISOString()).toBe(cutoff.toISOString());
    expect(canRequestChange('not-a-date', now)).toBe(false);
    expect(changeDeadline('2026-02-30T12:00:00.000Z')).toBeNull();
  });
  it('does not allow a second trial in the UI hint for already-booked or assessed profiles', () => {
    expect(trialPreviewEligibility('new')).toBe('eligible');
    expect(trialPreviewEligibility('trial_booked')).toBe('used');
    expect(trialPreviewEligibility('assessed')).toBe('used');
    expect(trialPreviewEligibility('active')).toBe('not-eligible');
    expect(trialPreviewEligibility('lapsed')).toBe('not-eligible');
  });
});
