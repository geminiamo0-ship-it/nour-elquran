/**
 * #110: D1 read boundary for owner-scoped learner profiles.
 *
 * Only pass an authSubject obtained from a server-verified, database-revalidated
 * Better Auth session. Never derive it from URL, body, role/header or demo state.
 * This module does NOT authenticate a request or expose an HTTP endpoint.
 */
export interface VerifiedAccountSubject {
  readonly authSubject: string;
  /** Present only for an explicitly verified child-restricted session. */
  readonly learnerScope?: string;
}

export interface OwnedLearner {
  readonly id: string;
  readonly displayName: string;
  readonly learnerType: 'adult' | 'child';
  readonly revision: number;
}

interface LearnerRow {
  id: string;
  display_name: string;
  learner_type: string;
  revision: number;
}

export interface BoundLearnerQuery {
  all<T>(): Promise<{ results: T[] }>;
}

export interface LearnerQuery {
  bind(...params: string[]): BoundLearnerQuery;
}

export interface LearnerReadDatabase {
  prepare(query: string): LearnerQuery;
}

const BASE_QUERY = `
  SELECT l.id, l.display_name, l.learner_type, l.revision
  FROM learners AS l
  INNER JOIN accounts AS a ON a.id = l.account_id
  WHERE a.auth_subject = ?1
    AND a.status = 'active'
    AND l.status = 'active'
`;

function validPrincipal(principal: VerifiedAccountSubject): boolean {
  return typeof principal.authSubject === 'string' && principal.authSubject.length > 0 &&
    (principal.learnerScope === undefined ||
      (typeof principal.learnerScope === 'string' && principal.learnerScope.length > 0));
}

function toOwnedLearner(row: LearnerRow): OwnedLearner | null {
  if (typeof row.id !== 'string' || !row.id ||
      typeof row.display_name !== 'string' ||
      (row.learner_type !== 'adult' && row.learner_type !== 'child') ||
      !Number.isSafeInteger(row.revision) || row.revision<1) return null;
  return { id: row.id, displayName: row.display_name, learnerType: row.learner_type, revision:row.revision };
}

/** Only active profiles belonging to the active account mapped to the verified subject. */
export async function listOwnedLearners(
  db: LearnerReadDatabase, principal: VerifiedAccountSubject,
): Promise<OwnedLearner[]> {
  if (!validPrincipal(principal)) return [];
  const scoped = principal.learnerScope !== undefined;
  const sql = BASE_QUERY +
    (scoped ? ' AND l.id = ?2' : '') +
    ' ORDER BY l.created_at_ms ASC, l.id ASC LIMIT 100';
  const query = db.prepare(sql).bind(...(scoped
    ? [principal.authSubject, principal.learnerScope as string]
    : [principal.authSubject]));
  const rows = (await query.all<LearnerRow>()).results;
  return rows.map(toOwnedLearner).filter((row): row is OwnedLearner => row !== null);
}

/** A URL-supplied learner ID is always checked against the verified account and child scope. */
export async function getOwnedLearner(
  db: LearnerReadDatabase, principal: VerifiedAccountSubject, learnerId: string,
): Promise<OwnedLearner | null> {
  if (!validPrincipal(principal) || !learnerId ||
      (principal.learnerScope !== undefined && principal.learnerScope !== learnerId)) return null;
  const query = db.prepare(BASE_QUERY + ' AND l.id = ?2 LIMIT 1')
    .bind(principal.authSubject, learnerId);
  const rows = (await query.all<LearnerRow>()).results;
  return rows.length > 0 ? toOwnedLearner(rows[0]!) : null;
}
