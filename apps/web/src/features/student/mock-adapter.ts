import {
  isLearnerProfile, MAX_SIBLINGS, scopedSnapshot,
  type LearnerProfile, type Lesson, type PracticeTask, type PublishedReport,
} from './domain';

export const DEMO_PROFILES: readonly LearnerProfile[] = [
  { id: 'demo-new', name: 'طالب جديد (مثال)', stage: 'new', demo: true },
  { id: 'demo-active', name: 'طالبة منتظمة (مثال)', stage: 'active', demo: true },
  { id: 'demo-trial', name: 'حجز تجريبي (مثال)', stage: 'trial_booked', demo: true },
];
const lessons: readonly Lesson[] = [
  { id: 'l-active-1', learnerId: 'demo-active', dayOffset: 0, time: '17:00', durationMinutes: 30, teacher: 'شيخ تجريبي', topic: 'مراجعة سورة الإخلاص', status: 'booked', kind: 'standard' },
  { id: 'l-active-2', learnerId: 'demo-active', dayOffset: 2, time: '18:30', durationMinutes: 30, teacher: 'شيخ تجريبي', topic: 'تثبيت المحفوظ', status: 'booked', kind: 'standard' },
  { id: 'l-active-3', learnerId: 'demo-active', dayOffset: -2, time: '17:00', durationMinutes: 30, teacher: 'شيخ تجريبي', topic: 'تقرير الحصة السابقة', status: 'completed', kind: 'standard' },
  { id: 'l-trial-1', learnerId: 'demo-trial', dayOffset: 1, time: '16:30', durationMinutes: 30, teacher: 'لم يُعيَّن شيخ حقيقي', topic: 'حصة تعريفية توضيحية', status: 'booked', kind: 'trial' },
];
const tasks: readonly PracticeTask[] = [
  { id: 't-1', learnerId: 'demo-active', title: 'مراجعة المحفوظ', scope: 'سورة الإخلاص · الآيات ١–٤', repetitions: 3, approvedByTeacher: true },
  { id: 't-2', learnerId: 'demo-active', title: 'تدريب على التلاوة', scope: 'سورة الفلق · الآيات ١–٥', repetitions: 2, approvedByTeacher: true },
  // Never expose a draft/non-teacher-approved task in the learner UI.
  { id: 't-draft', learnerId: 'demo-active', title: 'مسودة غير معتمدة', scope: 'غير منشورة', repetitions: null, approvedByTeacher: false },
];
const reports: readonly PublishedReport[] = [
  { id: 'r-active-1', learnerId: 'demo-active', lessonId: 'l-active-3', teacher: 'شيخ تجريبي', dateLabel: 'مثال لحصة سابقة', publishedAt: '2026-10-20T12:00:00Z', status: 'published', memorization: 8, recitation: 7, tajweed: null, memorizedAyat: 4, reviewedAyat: 4, summary: 'مثال توضيحي: تثبيت سورة الإخلاص مع متابعة مخارج الحروف.' },
];
/** A mock-only adapter. Does not call an API, persist children's data, or return bookings. */
export function getMockLearnerSnapshot(profile: LearnerProfile) {
  return scopedSnapshot(profile, lessons, tasks, reports);
}
export function readSessionDemoProfiles(storage: Pick<Storage, 'getItem'>): LearnerProfile[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem('noor:demo-profiles:v1') ?? 'null');
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > MAX_SIBLINGS) return [];
    const profiles: LearnerProfile[] = parsed.map((name, index) => ({
      id: 'session-learner-' + index, name, stage: 'new' as const, demo: true as const,
    }));
    return profiles.every(isLearnerProfile) ? profiles : [];
  } catch {
    return [];
  }
}
