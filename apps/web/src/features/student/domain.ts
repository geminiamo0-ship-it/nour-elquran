export type LearnerStage = 'new' | 'trial_booked' | 'assessed' | 'active' | 'lapsed';
export type LessonStatus = 'booked' | 'completed' | 'cancelled';
export type Grade = number | null;
export type LearnerProfile = Readonly<{ id: string; name: string; stage: LearnerStage; demo: true }>;
export type Lesson = Readonly<{
  id: string; learnerId: string; dayOffset: number; time: string; durationMinutes: number;
  teacher: string; topic: string; status: LessonStatus; kind: 'trial' | 'standard';
}>;
export type PracticeTask = Readonly<{
  id: string; learnerId: string; title: string; scope: string; repetitions: number | null;
  approvedByTeacher: boolean;
}>;
export type PublishedReport = Readonly<{
  id: string; learnerId: string; lessonId: string; teacher: string; dateLabel: string;
  publishedAt: string; status: 'published'; memorization: Grade; recitation: Grade; tajweed: Grade;
  memorizedAyat: number | null; reviewedAyat: number | null; summary: string;
}>;
export type LearnerSnapshot = Readonly<{
  profile: LearnerProfile; lessons: readonly Lesson[]; tasks: readonly PracticeTask[];
  reports: readonly PublishedReport[]; latestReport: PublishedReport | null;
}>;
export const MAX_SIBLINGS = 8;
const stages = new Set<LearnerStage>(['new', 'trial_booked', 'assessed', 'active', 'lapsed']);
export function isLearnerProfile(value: unknown): value is LearnerProfile {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 60
    && typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 50
    && typeof item.stage === 'string' && stages.has(item.stage as LearnerStage)
    && item.demo === true;
}
export function validateGrade(grade: unknown): grade is Grade {
  return grade === null || (typeof grade === 'number' && Number.isFinite(grade) && grade >= 0 && grade <= 10);
}
export function validatePublishedReport(value: unknown): value is PublishedReport {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return item.status === 'published' && typeof item.learnerId === 'string'
    && typeof item.publishedAt === 'string'
    && validateGrade(item.memorization) && validateGrade(item.recitation) && validateGrade(item.tajweed);
}
export function scopedSnapshot(
  profile: LearnerProfile, lessons: readonly Lesson[], tasks: readonly PracticeTask[],
  reports: readonly PublishedReport[]
): LearnerSnapshot {
  if (!isLearnerProfile(profile)) throw new Error('Invalid learner profile');
  const visibleReports = reports.filter((item) =>
    item.learnerId === profile.id && validatePublishedReport(item))
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
  return {
    profile,
    lessons: lessons.filter((item) => item.learnerId === profile.id),
    tasks: tasks.filter((item) => item.learnerId === profile.id && item.approvedByTeacher),
    reports: visibleReports,
    latestReport: visibleReports[0] ?? null,
  };
}

/** Browser-memory-only study notes, not teacher-published material. */
export type LocalStudyNote = Readonly<{
  id: string; learnerId: string; lessonId: string; text: string; createdAt: string;
}>;
export function sanitizeStudyNote(value: string): string | null {
  const text = value.trim();
  return text.length > 0 && text.length <= 500 ? text : null;
}
