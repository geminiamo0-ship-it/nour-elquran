import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { listVerifiedTeacherLearners, TEACHER_PRIMARY_ROSTER_SQL } from '../src/teacher-roster.ts';
import type { CoreDatabase } from '../src/bindings.ts';

test('roster is denied without verified subject and invalid time, no DB access', async () => {
  const db = { prepare: () => { throw Error('Unexpected database access'); } } as unknown as CoreDatabase;
  assert.equal(await listVerifiedTeacherLearners(db, ''), null);
  assert.equal(await listVerifiedTeacherLearners(db, 'teacher', Number.NaN), null);
  assert.equal(await listVerifiedTeacherLearners(db, 'teacher', -1), null);
});

test('qualified teacher is resolved in D1 before scoped roster query', async () => {
  const calls: Array<{ sql: string; bound: unknown[] }> = [];
  const db = { prepare: (sql: string) => ({
    bind: (...bound: unknown[]) => {
      calls.push({sql,bound});
      return {
        first: async () => ({id:'teacher-from-db'}),
        all: async () => ({results:[{id:'learner-1',name:'طالب',learnerType:'child'}]}),
      };
    },
  }) } as unknown as CoreDatabase;
  const data = await listVerifiedTeacherLearners(db, 'session-subject', 123);
  assert.deepEqual(data, [{id:'learner-1',name:'طالب',learnerType:'child'}]);
  assert.match(calls[0]!.sql, /qualified=1/);
  assert.deepEqual(calls[0]!.bound, ['session-subject']);
  assert.equal(calls[1]!.sql, TEACHER_PRIMARY_ROSTER_SQL);
  assert.deepEqual(calls[1]!.bound, ['teacher-from-db', 123, 123]);
});

test('inactive, unqualified or unmapped teacher receives 403 boundary (null)', async () => {
  const db = { prepare: () => ({
    bind: () => ({ first: async () => null }),
  }) } as unknown as CoreDatabase;
  assert.equal(await listVerifiedTeacherLearners(db, 'unqualified'), null);
});
