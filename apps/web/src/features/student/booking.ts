import type { LearnerStage } from './domain';

/** A backend must verify entitlement, prior trials and eligibility authoritatively. */
export function mayPreviewFirstTrial(stage: LearnerStage): boolean {
  return stage === 'new';
}

export const TRIAL_PRICE_EGP = 0;
export const TRIAL_DURATION_MIN = 30;
export const RESCHEDULE_CUTOFF_MS = 6 * 60 * 60 * 1000;

export type TimePreference = 'morning' | 'afternoon' | 'evening';
export type RequestedSlotPreference = Readonly<{ weekday: number; window: TimePreference }>;

/** Validate external/mocked DTOs at runtime, not just with a TypeScript assertion. */
export function isValidPreference(value: unknown): value is RequestedSlotPreference {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.weekday === 'number' && Number.isInteger(item.weekday)
    && item.weekday >= 0 && item.weekday <= 6
    && (item.window === 'morning' || item.window === 'afternoon' || item.window === 'evening');
}

const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/** Require explicit UTC and reject silently normalized calendar dates. */
function parseUtcInstant(value: string): number | null {
  if (!UTC_ISO.test(value)) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  const canonical = value.includes('.') ? value : value.slice(0, -1) + '.000Z';
  return new Date(time).toISOString() === canonical ? time : null;
}

/** Applies only to a confirmed lesson; server must repeat on its authoritative clock. */
export function maySelfReschedule(startAtIso: string, nowIso: string): boolean {
  const start = parseUtcInstant(startAtIso);
  const now = parseUtcInstant(nowIso);
  return start !== null && now !== null && start - now >= RESCHEDULE_CUTOFF_MS;
}
