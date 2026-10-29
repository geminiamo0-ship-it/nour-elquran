import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  decideTeacherStart, decideTeacherEnd, lessonTiming,
  INSTRUCTION_MS, RESERVATION_MS,
  type ClassroomLesson, type VerifiedActingTeacher, type VerifiedRoomPresence,
} from '../src/classroom/lifecycle.ts';

const lesson: ClassroomLesson = {
  id: 'lesson-a', learnerId: 'learner-a', actingTeacherId: 'teacher-a',
  status: 'scheduled', scheduledStartMs: 1_000_000,
  reservedUntilMs: 1_000_000 + RESERVATION_MS,
};
const teacher: VerifiedActingTeacher = {
  teacherId: 'teacher-a', authSubject: 'subject-a', qualified: true,
  active: true, grantedForLesson: true,
};
const room: VerifiedRoomPresence = {
  lessonId: lesson.id, learnerId: lesson.learnerId,
  teacherId: teacher.teacherId, teacherAuthSubject: teacher.authSubject,
  teacherConnected: true, learnerConnected: true, learnerAuthenticated: true,
};
const live: ClassroomLesson = { ...lesson, status: 'live' };

test('teacher can start a scheduled lesson only with both authenticated participants present', () => {
  assert.deepEqual(decideTeacherStart(lesson, teacher, room), { ok: true, code: 'START' });
  for (const changed of [
    { teacherConnected: false }, { learnerConnected: false },
    { learnerAuthenticated: false }, { lessonId: 'other' },
    { learnerId: 'sibling' }, { teacherId: 'other' },
    { teacherAuthSubject: 'other' },
  ]) {
    assert.deepEqual(
      decideTeacherStart(lesson, teacher, { ...room, ...changed }),
      { ok: false, code: 'WAITING_FOR_PARTICIPANTS' },
    );
  }
});

test('unauthorized, inactive or unqualified teacher cannot start OR end', () => {
  for (const changed of [
    { teacherId: 'other' }, { authSubject: '' }, { active: false },
    { qualified: false }, { grantedForLesson: false },
  ]) {
    const actor = { ...teacher, ...changed };
    assert.deepEqual(decideTeacherStart(lesson, actor, room), {
      ok: false, code: 'FORBIDDEN_TEACHER',
    });
    assert.deepEqual(decideTeacherEnd(live, actor), {
      ok: false, code: 'FORBIDDEN_TEACHER',
    });
  }
});

test('Start is safe under duplicate requests, cancelled lessons and ended history', () => {
  assert.deepEqual(decideTeacherStart(live, teacher, room), {
    ok: true, code: 'ALREADY_STARTED',
  });
  assert.deepEqual(decideTeacherStart({ ...lesson, status: 'cancelled' }, teacher, room), {
    ok: false, code: 'LESSON_CANCELLED',
  });
  assert.deepEqual(decideTeacherStart({ ...lesson, status: 'completed' }, teacher, room), {
    ok: false, code: 'LESSON_ALREADY_ENDED',
  });
  assert.deepEqual(decideTeacherStart({ ...lesson, reservedUntilMs: lesson.reservedUntilMs - 1 }, teacher, room), {
    ok: false, code: 'INVALID_LESSON',
  });
});

test('only active-class teacher End is permitted; duplicate End is safe', () => {
  assert.deepEqual(decideTeacherEnd(live, teacher), { ok: true, code: 'END' });
  assert.deepEqual(decideTeacherEnd(lesson, teacher), {
    ok: false, code: 'LESSON_NOT_STARTED',
  });
  assert.deepEqual(decideTeacherEnd({ ...lesson, status: 'completed' }, teacher), {
    ok: true, code: 'ALREADY_ENDED',
  });
  assert.deepEqual(decideTeacherEnd({ ...lesson, status: 'cancelled' }, teacher), {
    ok: false, code: 'LESSON_CANCELLED',
  });
});

test('late arrival 18+ minutes is not a start lockout if both people are present', () => {
  assert.equal(decideTeacherStart(lesson, teacher, room).ok, true);
  assert.equal(decideTeacherStart(lesson, teacher, room).code, 'START');
});

test('30m and 40m are alerts, never an auto-ending decision', () => {
  const start = lesson.scheduledStartMs;
  assert.deepEqual(lessonTiming(live, start), {
    instructionAlert: false, reservationAlert: false,
    overdue: false, suggestedAction: 'NO_AUTOMATIC_ACTION',
  });
  assert.deepEqual(lessonTiming(live, start + INSTRUCTION_MS), {
    instructionAlert: true, reservationAlert: false,
    overdue: false, suggestedAction: 'NO_AUTOMATIC_ACTION',
  });
  assert.deepEqual(lessonTiming(live, start + RESERVATION_MS), {
    instructionAlert: true, reservationAlert: true,
    overdue: false, suggestedAction: 'NO_AUTOMATIC_ACTION',
  });
  assert.deepEqual(lessonTiming(live, start + RESERVATION_MS * 3), {
    instructionAlert: true, reservationAlert: true,
    overdue: true, suggestedAction: 'NO_AUTOMATIC_ACTION',
  });
  assert.deepEqual(decideTeacherEnd(live, teacher), { ok: true, code: 'END' });
});

test('invalid timing fails closed without ending any live class', () => {
  assert.deepEqual(lessonTiming(live, Number.NaN), {
    instructionAlert: false, reservationAlert: false,
    overdue: false, suggestedAction: 'NO_AUTOMATIC_ACTION',
  });
  assert.deepEqual(decideTeacherStart({ ...lesson, id: '' }, teacher, room), {
    ok: false, code: 'INVALID_LESSON',
  });
});
