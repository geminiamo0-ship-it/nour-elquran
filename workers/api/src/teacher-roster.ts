import type { CoreDatabase } from './bindings.ts';

/**
 * B1: Only CURRENTLY active primary teacher assignments appear in the general
 * roster. A substitute can receive a separate lesson-scoped, approved brief;
 * it must never gain a permanent teacher roster from that exception.
 */
export interface TeacherRosterLearner {
  readonly id: string;
  readonly name: string;
  readonly learnerType: 'adult' | 'child';
}

export const TEACHER_PRIMARY_ROSTER_SQL = `
  SELECT learner.id, learner.display_name AS name,
         learner.learner_type AS learnerType
  FROM learners AS learner
  JOIN accounts AS owner ON owner.id = learner.account_id
  WHERE learner.status = 'active' AND owner.status = 'active'
    AND EXISTS (
      SELECT 1 FROM teacher_assignments AS assignment
      WHERE assignment.learner_id = learner.id
        AND assignment.teacher_id = ?1
        AND assignment.revoked_at_ms IS NULL
        AND assignment.starts_at_ms <= ?2
        AND assignment.ends_at_ms > ?2
    )
  ORDER BY learner.display_name COLLATE NOCASE ASC, learner.id ASC
  LIMIT 50
`;

export async function listVerifiedTeacherLearners(
  db: CoreDatabase, verifiedAuthSubject: string, now = Date.now(),
): Promise<TeacherRosterLearner[] | null> {
  // Null means not a qualified authenticated teacher; [] means teacher has no
  // current primary learners. Never expose substitute-only learners.
  if (typeof verifiedAuthSubject !== 'string' || !verifiedAuthSubject ||
      !Number.isSafeInteger(now) || now < 0) return null;
  const teacher = await db.prepare(
    "SELECT id FROM teachers WHERE auth_subject=? AND status='active' AND qualified=1 LIMIT 1",
  ).bind(verifiedAuthSubject).first<{ id: string }>();
  if (!teacher || !teacher.id) return null;
  const rows = await db.prepare(TEACHER_PRIMARY_ROSTER_SQL)
    .bind(teacher.id, now).all<TeacherRosterLearner>();
  return rows.results;
}
