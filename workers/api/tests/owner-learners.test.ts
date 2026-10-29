import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { getOwnedLearner, listOwnedLearners } from '../src/owner-learners.ts';
import type { LearnerReadDatabase } from '../src/owner-learners.ts';

type Row = { id: string; display_name: string; learner_type: string };
function spyDb(rows: Row[]) {
  const calls: { sql: string; params: string[] }[] = [];
  const db: LearnerReadDatabase = {
    prepare(sql) {
      return {
        bind(...params) {
          calls.push({ sql, params });
          return { all: async <T>() => ({ results: rows as T[] }) };
        },
      };
    },
  };
  return { db, calls };
}

test('account profile list is SQL-filtered by verified subject and active statuses', async () => {
  const { db, calls } = spyDb([{ id: 'learner-a', display_name: 'Fixture A', learner_type: 'child' }]);
  assert.deepEqual(await listOwnedLearners(db, { authSubject: 'auth-subject-a' }), [
    { id: 'learner-a', displayName: 'Fixture A', learnerType: 'child' },
  ]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.params, ['auth-subject-a']);
  assert.match(calls[0]?.sql ?? '', /a\.auth_subject = \?1/);
  assert.match(calls[0]?.sql ?? '', /a\.status = 'active'/);
  assert.match(calls[0]?.sql ?? '', /l\.status = 'active'/);
  assert.match(calls[0]?.sql ?? '', /LIMIT 100/);
});

test('child-restricted session scopes list and detail to its learner only', async () => {
  const { db, calls } = spyDb([{ id: 'learner-a', display_name: 'Fixture A', learner_type: 'child' }]);
  const actor = { authSubject: 'auth-a', learnerScope: 'learner-a' };
  assert.equal((await listOwnedLearners(db, actor)).length, 1);
  assert.deepEqual(calls[0]?.params, ['auth-a', 'learner-a']);
  assert.match(calls[0]?.sql ?? '', /l\.id = \?2/);
  assert.equal(await getOwnedLearner(db, actor, 'learner-b'), null);
  assert.equal(calls.length, 1, 'foreign sibling must not reach database');
  assert.deepEqual(await getOwnedLearner(db, actor, 'learner-a'), {
    id: 'learner-a', displayName: 'Fixture A', learnerType: 'child',
  });
  assert.deepEqual(calls[1]?.params, ['auth-a', 'learner-a']);
});

test('detail lookup always binds both verified account subject and URL learner ID', async () => {
  const { db, calls } = spyDb([]);
  assert.equal(await getOwnedLearner(db, { authSubject: 'auth-a' }, "other' OR 1=1 --"), null);
  assert.deepEqual(calls[0]?.params, ['auth-a', "other' OR 1=1 --"]);
  assert.match(calls[0]?.sql ?? '', /l\.id = \?2 LIMIT 1/);
  assert.doesNotMatch(calls[0]?.sql ?? '', /OR 1=1/);
});

test('missing subject, empty restricted scope, or empty learner ID fails before DB read', async () => {
  const { db, calls } = spyDb([]);
  assert.deepEqual(await listOwnedLearners(db, { authSubject: '' }), []);
  assert.deepEqual(await listOwnedLearners(db, { authSubject: 'auth-a', learnerScope: '' }), []);
  assert.equal(await getOwnedLearner(db, { authSubject: 'auth-a' }, ''), null);
  assert.equal(calls.length, 0);
});

test('unexpected D1 learner row shape never gets exposed', async () => {
  const { db } = spyDb([
    { id: 'valid', display_name: 'Fixture', learner_type: 'adult' },
    { id: 'invalid', display_name: 'Fixture', learner_type: 'staff' },
  ]);
  assert.deepEqual(await listOwnedLearners(db, { authSubject: 'auth-a' }), [
    { id: 'valid', displayName: 'Fixture', learnerType: 'adult' },
  ]);
});
