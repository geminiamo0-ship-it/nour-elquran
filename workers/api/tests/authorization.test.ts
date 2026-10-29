import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { authorizeLearner } from '../src/authorization.ts';
import type { Actor, TeacherGrant, LearnerResource, AuthorizationContext, LessonContext, LearnerPermission } from '../src/authorization.ts';

const resource: LearnerResource = { learnerId: 'learner-a', accountId: 'owner-a', active: true };
const teacher: Actor = { kind: 'teacher', teacherId: 'teacher-a' };
const primary: TeacherGrant = {
  teacherId: 'teacher-a', learnerId: 'learner-a', qualified: true, revoked: false,
  kind: 'primary', startsAt: 1000, endsAt: 10000,
};
const lesson: LessonContext = {
  lessonId: 'lesson-a', learnerId: 'learner-a', actualTeacherId: 'teacher-a',
  endedAt: 5000, firstReportPublishedAt: 6000, initialReportDeadline: null,
};
const substitute: TeacherGrant = { ...primary, kind: 'substitute', lessonId: 'lesson-a', acceptedAt: 900, consentDeadline: 950 };
const context: AuthorizationContext = { now: 4000, grant: substitute, lesson };

test('owner reads their learner, while other accounts and unauthenticated access fail', () => {
  assert.equal(authorizeLearner({ kind: 'account', accountId: 'owner-a' }, resource, 'private.read', context), true);
  assert.equal(authorizeLearner({ kind: 'account', accountId: 'other' }, resource, 'private.read', context), false);
  assert.equal(authorizeLearner(null, resource, 'learning.read', context), false);
});
test('a restricted learner session cannot switch to a sibling; account ownership is not a teacher role', () => {
  const actor: Actor = { kind: 'account', accountId: 'owner-a', learnerScope: 'learner-b' };
  assert.equal(authorizeLearner(actor, resource, 'learning.read', context), false);
  assert.equal(authorizeLearner({ kind: 'account', accountId: 'owner-a' }, resource, 'report.edit', context), false);
});
test('primary teacher needs active, qualified, unrevoked learner assignment', () => {
  const ok = { now: 4000, grant: primary };
  assert.equal(authorizeLearner(teacher, resource, 'learning.read', ok), true);
  for (const grant of [
    { ...primary, learnerId: 'learner-b' }, { ...primary, teacherId: 'other' },
    { ...primary, qualified: false }, { ...primary, revoked: true },
    { ...primary, startsAt: 4001 }, { ...primary, endsAt: 4000 },
  ]) assert.equal(authorizeLearner(teacher, resource, 'learning.read', { ...ok, grant }), false);
});
test('teacher cannot read private notes, including when acting as substitute', () => {
  assert.equal(authorizeLearner(teacher, resource, 'private.read', context), false);
  assert.equal(authorizeLearner(teacher, resource, 'private.read', { now: 4000, grant: primary }), false);
});
test('substitute gets brief only after explicit timely acceptance and only for taught lesson', () => {
  assert.equal(authorizeLearner(teacher, resource, 'brief.read', context), true);
  for (const grant of [{ ...substitute, acceptedAt: null }, { ...substitute, acceptedAt: 951 }, { ...substitute, lessonId: 'other' }]) {
    assert.equal(authorizeLearner(teacher, resource, 'brief.read', { ...context, grant }), false);
  }
  assert.equal(authorizeLearner(teacher, resource, 'learning.read', context), false);
  assert.equal(authorizeLearner(teacher, resource, 'brief.read', { ...context, lesson: { ...lesson, actualTeacherId: 'other' } }), false);
});
test('brief ends at actual lesson boundary even when nominal grant is longer', () => {
  assert.equal(authorizeLearner(teacher, resource, 'brief.read', { ...context, now: 4999 }), true);
  assert.equal(authorizeLearner(teacher, resource, 'brief.read', { ...context, now: 5000 }), false);
});
test('report correction has fixed 24h first-publication cutoff, not educational-summary access', () => {
  const end = 6000 + 24 * 60 * 60 * 1000;
  assert.equal(authorizeLearner(teacher, resource, 'report.edit', { ...context, now: end - 1 }), true);
  assert.equal(authorizeLearner(teacher, resource, 'report.edit', { ...context, now: end }), false);
  assert.equal(authorizeLearner(teacher, resource, 'brief.read', { ...context, now: 6001 }), false);
});
test('no invented initial-report grace period, and no grant after explicit revocation', () => {
  const unpublished = { ...lesson, firstReportPublishedAt: null };
  assert.equal(authorizeLearner(teacher, resource, 'report.edit', { ...context, now: 6000, lesson: unpublished }), false);
  assert.equal(authorizeLearner(teacher, resource, 'report.edit', {
    ...context, now: 6000, lesson: { ...unpublished, initialReportDeadline: 7000 },
  }), true);
  assert.equal(authorizeLearner(teacher, resource, 'report.edit', { ...context, now: 6001, grant: { ...substitute, revoked: true } }), false);
});
test('primary teacher report/brief access also requires matching lesson context', () => {
  assert.equal(authorizeLearner(teacher, resource, 'report.edit', { now: 4000, grant: primary }), false);
  assert.equal(authorizeLearner(teacher, resource, 'report.edit', { now: 4000, grant: primary, lesson: { ...lesson, learnerId: 'other' } }), false);
  assert.equal(authorizeLearner(teacher, resource, 'report.edit', { now: 4000, grant: primary, lesson }), true);
});
test('staff permissions do not expose personal notes or confer report-authoring authority', () => {
  const staff: Actor = { kind: 'staff', permissions: ['learning.read'] };
  assert.equal(authorizeLearner(staff, resource, 'learning.read', context), true);
  assert.equal(authorizeLearner(staff, resource, 'private.read', context), false);
  assert.equal(authorizeLearner(staff, resource, 'report.edit', context), false);
  assert.equal(authorizeLearner({ kind: 'staff', permissions: [] }, resource, 'learning.read', context), false);
});
test('inactive learner, invalid time, or unknown runtime permission deny access', () => {
  assert.equal(authorizeLearner(teacher, { ...resource, active: false }, 'learning.read', { now: 4000, grant: primary }), false);
  assert.equal(authorizeLearner(teacher, resource, 'learning.read', { now: Number.NaN, grant: primary }), false);
  assert.equal(authorizeLearner(teacher, resource, 'unknown' as LearnerPermission, { now: 4000, grant: primary }), false);
});
