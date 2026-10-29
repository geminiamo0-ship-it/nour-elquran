/**
 * Domain rules for a two-person Noor classroom.
 *
 * ALL inputs must be populated by trusted Workers/D1 + the lesson's authoritative
 * Durable Object presence snapshot, NEVER from user JSON or asserted client roles.
 * This module is intentionally not an HTTP endpoint or an automatic timer.
 */
export type LessonPhase = 'scheduled' | 'live' | 'completed' | 'cancelled';

export interface ClassroomLesson {
  readonly id: string;
  readonly learnerId: string;
  readonly actingTeacherId: string;
  readonly status: LessonPhase;
  readonly scheduledStartMs: number;
  /** The single 40-minute calendar interval, NOT an auto-termination deadline. */
  readonly reservedUntilMs: number;
}

export interface VerifiedActingTeacher {
  /** Verified Better Auth subject, resolved by Worker against teachers + active grant. */
  readonly authSubject: string;
  readonly teacherId: string;
  readonly qualified: boolean;
  readonly active: boolean;
  readonly grantedForLesson: boolean;
}

export interface VerifiedRoomPresence {
  readonly lessonId: string;
  readonly teacherId: string;
  readonly teacherAuthSubject: string;
  readonly learnerId: string;
  readonly teacherConnected: boolean;
  readonly learnerConnected: boolean;
  /** Derived by the Worker after account/learner scope verification. */
  readonly learnerAuthenticated: boolean;
}

export type LifecycleRejection =
  | 'INVALID_LESSON'
  | 'FORBIDDEN_TEACHER'
  | 'WAITING_FOR_PARTICIPANTS'
  | 'LESSON_CANCELLED'
  | 'LESSON_ALREADY_ENDED'
  | 'LESSON_NOT_STARTED';

export type LifecycleDecision =
  | { readonly ok: true; readonly code: 'START' | 'END' | 'ALREADY_STARTED' | 'ALREADY_ENDED' }
  | { readonly ok: false; readonly code: LifecycleRejection };

export const INSTRUCTION_MS = 30 * 60 * 1000;
export const RESERVATION_MS = 40 * 60 * 1000;

function isPositiveTime(n: number): boolean {
  return Number.isSafeInteger(n) && n >= 0;
}

function validLesson(lesson: ClassroomLesson): boolean {
  return !!lesson.id && !!lesson.learnerId && !!lesson.actingTeacherId &&
    isPositiveTime(lesson.scheduledStartMs) &&
    isPositiveTime(lesson.reservedUntilMs) &&
    lesson.reservedUntilMs - lesson.scheduledStartMs === RESERVATION_MS;
}

function authorizedTeacher(lesson: ClassroomLesson, teacher: VerifiedActingTeacher): boolean {
  return teacher.active && teacher.qualified && teacher.grantedForLesson &&
    !!teacher.authSubject && !!teacher.teacherId && teacher.teacherId === lesson.actingTeacherId;
}

/** Only used by the verified teacher Start command, with live DO members as evidence. */
export function decideTeacherStart(
  lesson: ClassroomLesson, teacher: VerifiedActingTeacher, room: VerifiedRoomPresence,
): LifecycleDecision {
  if (!validLesson(lesson)) return { ok: false, code: 'INVALID_LESSON' };
  if (!authorizedTeacher(lesson, teacher)) return { ok: false, code: 'FORBIDDEN_TEACHER' };
  if (lesson.status === 'cancelled') return { ok: false, code: 'LESSON_CANCELLED' };
  if (lesson.status === 'completed') return { ok: false, code: 'LESSON_ALREADY_ENDED' };
  if (lesson.status === 'live') return { ok: true, code: 'ALREADY_STARTED' };
  if (room.lessonId !== lesson.id || room.teacherId !== teacher.teacherId ||
      room.teacherAuthSubject !== teacher.authSubject ||
      room.learnerId !== lesson.learnerId || !room.teacherConnected ||
      !room.learnerConnected || !room.learnerAuthenticated) {
    return { ok: false, code: 'WAITING_FOR_PARTICIPANTS' };
  }
  return { ok: true, code: 'START' };
}

/** Explicit teacher action only. Time passing 30/40 minutes never calls this. */
export function decideTeacherEnd(
  lesson: ClassroomLesson, teacher: VerifiedActingTeacher,
): LifecycleDecision {
  if (!validLesson(lesson)) return { ok: false, code: 'INVALID_LESSON' };
  if (!authorizedTeacher(lesson, teacher)) return { ok: false, code: 'FORBIDDEN_TEACHER' };
  if (lesson.status === 'completed') return { ok: true, code: 'ALREADY_ENDED' };
  if (lesson.status === 'cancelled') return { ok: false, code: 'LESSON_CANCELLED' };
  if (lesson.status !== 'live') return { ok: false, code: 'LESSON_NOT_STARTED' };
  return { ok: true, code: 'END' };
}

export interface LessonTiming {
  readonly instructionAlert: boolean;
  readonly reservationAlert: boolean;
  readonly overdue: boolean;
  readonly suggestedAction: 'NO_AUTOMATIC_ACTION';
}

/**
 * Display-only alert flags based on the original scheduled start. They do not
 * start, end, credit, extend or penalize a lesson.
 */
export function lessonTiming(lesson: ClassroomLesson, nowMs: number): LessonTiming {
  const valid = validLesson(lesson) && isPositiveTime(nowMs);
  return {
    instructionAlert: valid && nowMs >= lesson.scheduledStartMs + INSTRUCTION_MS,
    reservationAlert: valid && nowMs >= lesson.reservedUntilMs,
    overdue: valid && nowMs > lesson.reservedUntilMs,
    suggestedAction: 'NO_AUTOMATIC_ACTION',
  };
}
