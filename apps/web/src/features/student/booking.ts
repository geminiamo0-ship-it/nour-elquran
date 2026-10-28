import type { LearnerStage } from './domain';
/** An actual backend must verify entitlement, prior trials and eligibility authoritatively. */
export function mayPreviewFirstTrial(stage: LearnerStage): boolean { return stage === 'new'; }
export const TRIAL_PRICE_EGP = 0;
export const TRIAL_DURATION_MIN = 30;
export const RESCHEDULE_CUTOFF_MS = 6 * 60 * 60 * 1000;
export type TimePreference = 'morning' | 'afternoon' | 'evening';
export type RequestedSlotPreference = Readonly<{ weekday: number; window: TimePreference }>;
export function isValidPreference(item: RequestedSlotPreference): boolean {
  return Number.isInteger(item.weekday) && item.weekday >= 0 && item.weekday <= 6 &&
    (item.window === 'morning' || item.window === 'afternoon' || item.window === 'evening');
}
/** Applies only to a *confirmed* lesson time; server must repeat check on the authoritative clock. */
export function maySelfReschedule(startAtIso: string, nowIso: string): boolean {
  const start = Date.parse(startAtIso);
  const now = Date.parse(nowIso);
  return Number.isFinite(start) && Number.isFinite(now) && start - now >= RESCHEDULE_CUTOFF_MS;
}
