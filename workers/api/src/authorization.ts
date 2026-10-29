/** Inputs MUST be loaded by the server after authentication, never decoded from client role headers. */
export type LearnerPermission = 'learning.read' | 'private.read' | 'brief.read' | 'report.edit';
export type Actor =
  | Readonly<{ kind: 'account'; accountId: string; learnerScope?: string }>
  | Readonly<{ kind: 'teacher'; teacherId: string }>
  | Readonly<{ kind: 'staff'; permissions: readonly string[] }>;
export type LearnerResource = Readonly<{ learnerId: string; accountId: string; active: boolean }>;
export type TeacherGrant = Readonly<{
  teacherId: string; learnerId: string; qualified: boolean; revoked: boolean;
  kind: 'primary' | 'substitute'; startsAt: number; endsAt: number;
  lessonId?: string; acceptedAt?: number | null; consentDeadline?: number;
}>;
export type LessonContext = Readonly<{
  lessonId: string; learnerId: string; actualTeacherId: string;
  endedAt: number | null; firstReportPublishedAt: number | null;
  initialReportDeadline: number | null;
}>;
export type AuthorizationContext = Readonly<{
  now: number; grant?: TeacherGrant; lesson?: LessonContext;
}>;
const REPORT_CORRECTION_MS = 24 * 60 * 60 * 1000;

function finite(value: number): boolean { return Number.isFinite(value) && value >= 0; }
function ownsTaughtLesson(actor: Extract<Actor, { kind: 'teacher' }>,
  resource: LearnerResource, grant: TeacherGrant, lesson: LessonContext | undefined): lesson is LessonContext {
  return !!lesson && lesson.learnerId === resource.learnerId &&
    lesson.actualTeacherId === actor.teacherId && lesson.lessonId === grant.lessonId;
}

function substituteAllowed(actor: Extract<Actor, { kind: 'teacher' }>, resource: LearnerResource,
  permission: LearnerPermission, grant: TeacherGrant, context: AuthorizationContext): boolean {
  const { now, lesson } = context;
  if (grant.acceptedAt == null || !finite(grant.acceptedAt) || grant.acceptedAt > now || grant.consentDeadline === undefined ||
      !finite(grant.consentDeadline) || grant.acceptedAt > grant.consentDeadline ||
      !ownsTaughtLesson(actor, resource, grant, lesson)) return false;
  const live = now >= grant.startsAt && now < grant.endsAt &&
    (lesson.endedAt === null || now < lesson.endedAt);
  if (permission === 'brief.read') return live;
  if (permission !== 'report.edit' || now < grant.startsAt) return false;
  if (live) return true;
  if (lesson.firstReportPublishedAt !== null) {
    const published = lesson.firstReportPublishedAt;
    return finite(published) && published <= now && now < published + REPORT_CORRECTION_MS;
  }
  // The owner has not chosen the first-report-after-class deadline. No invented grace period.
  return lesson.initialReportDeadline !== null && finite(lesson.initialReportDeadline) &&
    now < lesson.initialReportDeadline;
}

export function authorizeLearner(actor: Actor | null, resource: LearnerResource,
  permission: LearnerPermission, context: AuthorizationContext): boolean {
  if (!actor || !resource.active || !finite(context.now) ||
      !['learning.read','private.read','brief.read','report.edit'].includes(permission)) return false;
  if (actor.kind === 'account') {
    return actor.accountId === resource.accountId &&
      (!actor.learnerScope || actor.learnerScope === resource.learnerId) &&
      (permission === 'learning.read' || permission === 'private.read');
  }
  if (actor.kind === 'staff') {
    return permission === 'learning.read' && actor.permissions.includes('learning.read');
  }
  if (actor.kind !== 'teacher') return false;
  const grant = context.grant;
  if (!grant || !grant.qualified || grant.revoked || grant.teacherId !== actor.teacherId ||
      grant.learnerId !== resource.learnerId || !finite(grant.startsAt) || !finite(grant.endsAt) ||
      grant.endsAt <= grant.startsAt || permission === 'private.read') return false;
  if (grant.kind === 'substitute') return substituteAllowed(actor, resource, permission, grant, context);
  if (grant.kind !== 'primary') return false;
  if (permission !== 'learning.read' && context.lesson?.learnerId !== resource.learnerId) return false;
  return context.now >= grant.startsAt && context.now < grant.endsAt;
}
