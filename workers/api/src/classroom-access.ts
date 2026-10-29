import type { CoreDatabase } from './bindings.ts';

/**
 * Authorization-only classroom access checks for the verified Better Auth session.
 *
 * No room is created, no identity/role/presence is ever taken from a client
 * JSON body, and private child notes/contacts/audio are never selected.
 * Actual connection/Start still require LessonDO and verified two-party presence.
 */
export type ClassroomAccess = Readonly<{
  id: string;
  learnerId: string;
  learnerName?: string;
  kind: 'trial' | 'standard' | 'makeup';
  status: 'scheduled' | 'live';
  startsAtMs: number;
  endsAtMs: number;
  role: 'teacher' | 'learner';
  teacherScope?: 'primary' | 'substitute';
}>;

export const TEACHER_CLASSROOM_ACCESS_SQL = `
 SELECT l.id, l.learner_id AS learnerId, learner.display_name AS learnerName,
        l.kind, l.status, l.starts_at_ms AS startsAtMs, l.ends_at_ms AS endsAtMs,
        'teacher' AS role,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM teacher_assignments a
            WHERE a.teacher_id = t.id AND a.learner_id = l.learner_id
              AND a.revoked_at_ms IS NULL
              AND a.starts_at_ms <= l.starts_at_ms
              AND a.ends_at_ms >= l.ends_at_ms
          ) THEN 'primary'
          WHEN EXISTS (
            SELECT 1 FROM lesson_access_grants g
            WHERE g.lesson_id = l.id AND g.learner_id = l.learner_id
              AND g.teacher_id = t.id AND g.kind = 'primary'
              AND g.revoked_at_ms IS NULL
              AND g.starts_at_ms <= l.starts_at_ms
              AND g.ends_at_ms >= l.ends_at_ms
          ) THEN 'primary'
          ELSE 'substitute'
        END AS teacherScope
 FROM lessons l
 JOIN teachers t ON t.id = l.actual_teacher_id
 JOIN learners learner ON learner.id = l.learner_id
 JOIN accounts account ON account.id = learner.account_id
 WHERE l.id = ? AND t.auth_subject = ?
   AND t.status = 'active' AND t.qualified = 1
   AND learner.status = 'active' AND account.status = 'active'
   AND l.status IN ('scheduled','live')
   AND (
     EXISTS (
       SELECT 1 FROM teacher_assignments a
       WHERE a.teacher_id = t.id AND a.learner_id = l.learner_id
         AND a.revoked_at_ms IS NULL
         AND a.starts_at_ms <= l.starts_at_ms
         AND a.ends_at_ms >= l.ends_at_ms
     )
     OR EXISTS (
       SELECT 1 FROM lesson_access_grants g
       WHERE g.lesson_id = l.id AND g.learner_id = l.learner_id
         AND g.teacher_id = t.id AND g.revoked_at_ms IS NULL
         AND g.starts_at_ms <= l.starts_at_ms
         AND g.ends_at_ms >= l.ends_at_ms
         AND (
           g.kind = 'primary'
           OR (
             g.kind = 'substitute'
             AND g.accepted_at_ms IS NOT NULL
             AND g.consent_deadline_ms IS NOT NULL
             AND g.accepted_at_ms <= g.consent_deadline_ms
             AND g.accepted_at_ms <= ?
           )
         )
     )
   )
 LIMIT 1
`;

export const LEARNER_CLASSROOM_ACCESS_SQL = `
 SELECT l.id, l.learner_id AS learnerId,
        l.kind, l.status, l.starts_at_ms AS startsAtMs, l.ends_at_ms AS endsAtMs,
        'learner' AS role
 FROM lessons l
 JOIN learners learner ON learner.id = l.learner_id
 JOIN accounts account ON account.id = learner.account_id
 WHERE l.id = ? AND l.learner_id = ? AND account.id = ?
   AND learner.status = 'active' AND account.status = 'active'
   AND l.status IN ('scheduled','live')
 LIMIT 1
`;

const IDENTIFIER = /^[a-zA-Z0-9-]{1,128}$/;
export async function checkTeacherClassroomAccess(
  db: CoreDatabase, verifiedSubject: string, lessonId: string, now = Date.now(),
): Promise<ClassroomAccess | null> {
  if (!verifiedSubject || !IDENTIFIER.test(lessonId) || !Number.isFinite(now) || now < 0) return null;
  return db.prepare(TEACHER_CLASSROOM_ACCESS_SQL)
    .bind(lessonId, verifiedSubject, now).first<ClassroomAccess>();
}

export async function checkOwnedLearnerClassroomAccess(
  db: CoreDatabase, verifiedAccountId: string, verifiedLearnerId: string, lessonId: string,
): Promise<ClassroomAccess | null> {
  if (!verifiedAccountId || !IDENTIFIER.test(verifiedLearnerId) || !IDENTIFIER.test(lessonId)) return null;
  return db.prepare(LEARNER_CLASSROOM_ACCESS_SQL)
    .bind(lessonId, verifiedLearnerId, verifiedAccountId).first<ClassroomAccess>();
}
