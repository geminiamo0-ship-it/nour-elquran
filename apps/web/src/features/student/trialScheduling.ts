import type { LearnerStage } from './domain';

export const TRIAL_DURATION_MINUTES = 30 as const;
export const CHANGE_CUTOFF_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export type TrialPreviewSlot = Readonly<{
  id: string;
  learnerId: string;
  startsAt: string;
  durationMinutes: typeof TRIAL_DURATION_MINUTES;
  source: 'illustration';
}>;

export function isValidTrialPreviewSlot(value: unknown, learnerId: string, now: Date): value is TrialPreviewSlot {
  if (!value || typeof value !== 'object' || !Number.isFinite(now.getTime())) return false;
  const item = value as Record<string, unknown>;
  if (typeof item.startsAt !== 'string' || !UTC_ISO.test(item.startsAt)) return false;
  const time = Date.parse(item.startsAt);
  return typeof item.id === 'string' && /^trial-example-[0-9]+$/.test(item.id)
    && item.learnerId === learnerId && item.source === 'illustration'
    && item.durationMinutes === TRIAL_DURATION_MINUTES
    && Number.isFinite(time) && new Date(time).toISOString() === item.startsAt
    && time > now.getTime();
}

/** A display hint only. Server-side trial entitlement must be authoritative. */
export function trialPreviewEligibility(stage: LearnerStage): 'eligible' | 'used' | 'not-eligible' {
  if (stage === 'new') return 'eligible';
  if (stage === 'trial_booked' || stage === 'assessed') return 'used';
  return 'not-eligible';
}

/** UTC instant comparison; exact T-6h is allowed, one millisecond later is not. */
export function canRequestChange(startsAt: string, now: Date): boolean {
  if (!UTC_ISO.test(startsAt) || !Number.isFinite(now.getTime())) return false;
  const start = Date.parse(startsAt);
  return Number.isFinite(start) && new Date(start).toISOString() === startsAt
    && start - now.getTime() >= CHANGE_CUTOFF_MS;
}

export function changeDeadline(startsAt: string): Date | null {
  if (!UTC_ISO.test(startsAt)) return null;
  const start = Date.parse(startsAt);
  if (!Number.isFinite(start) || new Date(start).toISOString() !== startsAt) return null;
  return new Date(start - CHANGE_CUTOFF_MS);
}

/** Synthetic choices, never actual teacher availability or reservations. */
export function getMockTrialPreviewSlots(learnerId: string, now: Date): readonly TrialPreviewSlot[] {
  if (!learnerId || !Number.isFinite(now.getTime())) return [];
  return [0, 1, 2].map((index) => {
    const date = new Date(now.getTime() + (index + 2) * DAY_MS);
    date.setUTCHours(14 + index * 2, 0, 0, 0);
    return {
      id: 'trial-example-' + (index + 1),
      learnerId,
      startsAt: date.toISOString(),
      durationMinutes: TRIAL_DURATION_MINUTES,
      source: 'illustration' as const,
    };
  }).filter((slot) => isValidTrialPreviewSlot(slot, learnerId, now));
}
