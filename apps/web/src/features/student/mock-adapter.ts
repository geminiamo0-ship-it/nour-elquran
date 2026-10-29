import {
  isLearnerProfile, MAX_SIBLINGS, scopedSnapshot,
  type LearnerProfile, type Lesson, type PracticeTask, type PublishedReport,
} from './domain';
import { QURAN_EDITION, QURAN_VERSION } from './quranSource';
import type { PublishedNotebookRevision } from './notebookContracts';

export const DEMO_PROFILES: readonly LearnerProfile[] = [
  { id: 'demo-new', name: 'طالب جديد (مثال)', stage: 'new', demo: true },
  { id: 'demo-active', name: 'طالبة منتظمة (مثال)', stage: 'active', demo: true },
  { id: 'demo-trial', name: 'حجز تجريبي (مثال)', stage: 'trial_booked', demo: true },
];
const lessons: readonly Lesson[] = [
  { id: 'l-active-1', learnerId: 'demo-active', dayOffset: 0, time: '17:00', durationMinutes: 30, teacher: 'شيخ تجريبي', topic: 'مراجعة سورة الإخلاص', status: 'booked', kind: 'standard' },
  { id: 'l-active-2', learnerId: 'demo-active', dayOffset: 2, time: '18:30', durationMinutes: 30, teacher: 'شيخ تجريبي', topic: 'تثبيت المحفوظ', status: 'booked', kind: 'standard' },
  { id: 'l-active-3', learnerId: 'demo-active', dayOffset: -2, time: '17:00', durationMinutes: 30, teacher: 'شيخ تجريبي', topic: 'تقرير الحصة السابقة', status: 'completed', kind: 'standard' },
  { id: 'l-active-4', learnerId: 'demo-active', dayOffset: -4, time: '16:00', durationMinutes: 30, teacher: 'شيخ تجريبي', topic: 'مثال متعدد الصفحات: الفاتحة والبقرة', status: 'completed', kind: 'standard' },
  { id: 'l-trial-1', learnerId: 'demo-trial', dayOffset: 1, time: '16:30', durationMinutes: 30, teacher: 'لم يُعيَّن شيخ حقيقي', topic: 'حصة تعريفية توضيحية', status: 'booked', kind: 'trial' },
];
const tasks: readonly PracticeTask[] = [
  { id: 't-1', learnerId: 'demo-active', title: 'مراجعة المحفوظ', scope: 'سورة الإخلاص · الآيات ١–٤', repetitions: 3, approvedByTeacher: true, kind: 'revision', quranRange: { surah: 112, fromAyah: 1, toAyah: 4, page: 604 } },
  { id: 't-2', learnerId: 'demo-active', title: 'تدريب على التلاوة', scope: 'سورة الفلق · الآيات ١–٥', repetitions: 2, approvedByTeacher: true, kind: 'recitation', quranRange: { surah: 113, fromAyah: 1, toAyah: 5, page: 604 } },
  // Never expose a draft/non-teacher-approved task in the learner UI.
  { id: 't-draft', learnerId: 'demo-active', title: 'مسودة غير معتمدة', scope: 'غير منشورة', repetitions: null, approvedByTeacher: false },
];
const reports: readonly PublishedReport[] = [
  { id: 'r-active-2', learnerId: 'demo-active', lessonId: 'l-active-4', teacher: 'شيخ تجريبي', dateLabel: 'مثال متعدد الصفحات', publishedAt: '2026-10-19T12:00:00Z', status: 'published', memorization: null, recitation: 8, tajweed: null, memorizedAyat: null, reviewedAyat: 2, summary: 'بيانات اصطناعية لاختبار التنقل بين صفحتين والتحقق من حدود الآيات.' },
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

/**
 * Explicitly synthetic lesson publication for browser QA. Not a server record.
 * New/connected learners never receive this example, even with the same lesson ID.
 */
export function getMockNotebookRevisions(profile: LearnerProfile): readonly PublishedNotebookRevision[] {
  if (!profile.demo || profile.id !== 'demo-active') return [];
  const report = reports.find((item) => item.id === 'r-active-1');
  if (!report) return [];
  return [{
    id: 'demo-notebook-r1', learnerId: profile.id, lessonId: 'l-active-3',
    revision: 1, publishedAt: report.publishedAt, report,
    scope: {
      edition: QURAN_EDITION, version: QURAN_VERSION,
      start: { surah: 112, ayah: 1, page: 604 },
      end: { surah: 112, ayah: 4, page: 604 },
    },
    approvedAnnotations: [{
      id: 'demo-teacher-mark', learnerId: profile.id, lessonId: 'l-active-3',
      type: 'teacher', published: true, authorLabel: 'شيخ تجريبي',
      target: { page: 604, surah: 112, ayah: 2, wordIndex: null },
      text: 'مثال توضيحي لتصحيح الحصة، وليس تقييمًا لطالب حقيقي.',
      color: '#AD8028', createdAt: report.publishedAt,
    }],
    archive: 'unavailable',
  }, {
    id: 'demo-notebook-multipage-r1', learnerId: profile.id, lessonId: 'l-active-4',
    revision: 1, publishedAt: '2026-10-19T12:00:00Z',
    report: reports.find((item) => item.id === 'r-active-2')!,
    scope: {
      edition: QURAN_EDITION, version: QURAN_VERSION,
      start: { surah: 1, ayah: 6, page: 1 },
      end: { surah: 2, ayah: 2, page: 2 },
    },
    approvedAnnotations: [
      {
        id: 'demo-page-one-mark', learnerId: profile.id, lessonId: 'l-active-4',
        type: 'teacher', published: true, authorLabel: 'شيخ تجريبي',
        target: { page: 1, surah: 1, ayah: 7, wordIndex: null },
        text: 'علامة اصطناعية للصفحة الأولى فقط.',
        color: '#AD8028', createdAt: '2026-10-19T12:00:00Z',
      },
      {
        id: 'demo-page-two-mark', learnerId: profile.id, lessonId: 'l-active-4',
        type: 'teacher', published: true, authorLabel: 'شيخ تجريبي',
        target: { page: 2, surah: 2, ayah: 2, wordIndex: null },
        text: 'علامة اصطناعية للصفحة الثانية فقط.',
        color: '#AD8028', createdAt: '2026-10-19T12:00:00Z',
      },
    ],
    archive: 'unavailable',
  }];
}
