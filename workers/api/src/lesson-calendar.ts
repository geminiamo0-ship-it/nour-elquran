import type { CoreDatabase } from './bindings.ts';

/**
 * Genuine D1 read boundaries for timetable pages. Never accept an arbitrary
 * teacher ID from URL/headers: the subject here MUST be Better Auth verified.
 * No private Quran notes, reports, contact details or audio asset URLs returned.
 */
export interface CalendarLesson {
  readonly id: string;
  readonly learnerId: string;
  readonly learnerName?: string;
  readonly actingTeacherId?: string;
  readonly kind: 'trial' | 'standard' | 'makeup';
  readonly status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  readonly startsAtMs: number;
  readonly endsAtMs: number;
}

export const TEACHER_LESSONS_SQL = `
  SELECT l.id, l.learner_id AS learnerId, learner.display_name AS learnerName,
         l.kind, l.status, l.starts_at_ms AS startsAtMs, l.ends_at_ms AS endsAtMs
  FROM lessons l
  JOIN learners learner ON learner.id = l.learner_id
  JOIN accounts owner ON owner.id = learner.account_id
  WHERE l.actual_teacher_id = ?
    AND learner.status = 'active' AND owner.status = 'active'
    AND (
      EXISTS (
        SELECT 1 FROM teacher_assignments primary_assignment
        WHERE primary_assignment.teacher_id = l.actual_teacher_id
          AND primary_assignment.learner_id = l.learner_id
          AND primary_assignment.revoked_at_ms IS NULL
          AND primary_assignment.starts_at_ms <= l.starts_at_ms
          AND primary_assignment.ends_at_ms >= l.ends_at_ms
      )
      OR EXISTS (
        SELECT 1 FROM lesson_access_grants grant_row
        WHERE grant_row.lesson_id = l.id
          AND grant_row.learner_id = l.learner_id
          AND grant_row.teacher_id = l.actual_teacher_id
          AND grant_row.revoked_at_ms IS NULL
          AND grant_row.starts_at_ms <= l.starts_at_ms
          AND grant_row.ends_at_ms >= l.ends_at_ms
          AND (
            grant_row.kind = 'primary'
            OR (grant_row.kind = 'substitute'
                AND grant_row.accepted_at_ms IS NOT NULL
                AND grant_row.consent_deadline_ms IS NOT NULL
                AND grant_row.accepted_at_ms <= grant_row.consent_deadline_ms)
          )
      )
    )
  ORDER BY l.starts_at_ms DESC, l.id DESC
  LIMIT 50
`;

export const LEARNER_LESSONS_SQL = `
  SELECT l.id, l.learner_id AS learnerId, l.actual_teacher_id AS actingTeacherId,
         l.kind, l.status, l.starts_at_ms AS startsAtMs, l.ends_at_ms AS endsAtMs
  FROM lessons l
  JOIN learners learner ON learner.id = l.learner_id
  JOIN accounts owner ON owner.id = learner.account_id
  WHERE l.learner_id = ?
    AND learner.account_id = ?
    AND learner.status = 'active'
    AND owner.status = 'active'
  ORDER BY l.starts_at_ms DESC, l.id DESC
  LIMIT 50
`;

type QualifiedTeacher = { id: string };

export async function listVerifiedTeacherLessons(
  db: CoreDatabase, verifiedAuthSubject: string,
): Promise<CalendarLesson[] | null> {
  if (typeof verifiedAuthSubject !== 'string' || !verifiedAuthSubject) return null;
  const teacher = await db.prepare(
    "SELECT id FROM teachers WHERE auth_subject=? AND status='active' AND qualified=1 LIMIT 1",
  ).bind(verifiedAuthSubject).first<QualifiedTeacher>();
  if (!teacher) return null;
  const rows = await db.prepare(TEACHER_LESSONS_SQL).bind(teacher.id).all<CalendarLesson>();
  return rows.results;
}

export async function listOwnedLearnerLessons(
  db: CoreDatabase, verifiedAccountId: string, verifiedLearnerId: string,
): Promise<CalendarLesson[]> {
  if (!verifiedAccountId || !verifiedLearnerId) return [];
  const rows = await db.prepare(LEARNER_LESSONS_SQL)
    .bind(verifiedLearnerId, verifiedAccountId).all<CalendarLesson>();
  return rows.results;
}
