import { describe, expect, it } from 'vitest';
import {
  isValidPreference, mayPreviewFirstTrial, maySelfReschedule,
  RESCHEDULE_CUTOFF_MS, TRIAL_DURATION_MIN, TRIAL_PRICE_EGP,
} from './booking';

describe('S03 trial eligibility and scheduling contracts', () => {
  it('limits illustrative first-trial flow to new profiles, 30 minutes and zero EGP', () => {
    expect(TRIAL_PRICE_EGP).toBe(0);
    expect(TRIAL_DURATION_MIN).toBe(30);
    expect(mayPreviewFirstTrial('new')).toBe(true);
    for (const stage of ['trial_booked', 'assessed', 'active', 'lapsed'] as const) {
      expect(mayPreviewFirstTrial(stage)).toBe(false);
    }
  });

  it('validates untrusted preference payloads rather than trusting TypeScript types', () => {
    expect(isValidPreference({ weekday: 6, window: 'evening' })).toBe(true);
    expect(isValidPreference({ weekday: 0, window: 'morning' })).toBe(true);
    expect(isValidPreference(null)).toBe(false);
    expect(isValidPreference({ weekday: 7, window: 'morning' })).toBe(false);
    expect(isValidPreference({ weekday: -1, window: 'morning' })).toBe(false);
    expect(isValidPreference({ weekday: 1.5, window: 'morning' })).toBe(false);
    expect(isValidPreference({ weekday: '6', window: 'evening' })).toBe(false);
    expect(isValidPreference({ weekday: 6, window: 'overnight' })).toBe(false);
    expect(isValidPreference({ weekday: 6 })).toBe(false);
  });

  it('allows self-service change through exact UTC T−6h, never after it', () => {
    const start = '2026-10-30T20:00:00Z';
    const cutoff = Date.parse(start) - RESCHEDULE_CUTOFF_MS;
    expect(RESCHEDULE_CUTOFF_MS).toBe(21600000);
    expect(maySelfReschedule(start, new Date(cutoff - 1).toISOString())).toBe(true);
    expect(maySelfReschedule(start, new Date(cutoff).toISOString())).toBe(true);
    expect(maySelfReschedule(start, new Date(cutoff + 1).toISOString())).toBe(false);
  });

  it('rejects ambiguous local/offset times and impossible calendar dates', () => {
    const now = '2026-10-30T10:00:00.000Z';
    expect(maySelfReschedule('2026-10-30T20:00:00', now)).toBe(false);
    expect(maySelfReschedule('2026-10-30T20:00:00+00:00', now)).toBe(false);
    expect(maySelfReschedule('2026-02-30T20:00:00Z', now)).toBe(false);
    expect(maySelfReschedule('2026-10-30T20:00:00Z', '2026-02-30T10:00:00Z')).toBe(false);
    expect(maySelfReschedule('bad-time', now)).toBe(false);
  });

  it('uses UTC instants even across Egypt clock changes, not wall-clock subtraction', () => {
    const start = '2026-10-30T02:00:00.000Z';
    const cutoff = new Date(Date.parse(start) - RESCHEDULE_CUTOFF_MS);
    expect(maySelfReschedule(start, cutoff.toISOString())).toBe(true);
    expect(maySelfReschedule(start, new Date(cutoff.getTime() + 1).toISOString())).toBe(false);
  });
});
