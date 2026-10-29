import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import worker from '../src/index.ts';

const request = (path, init) => new Request('https://api.example.invalid' + path, init);
const migration = readFileSync(
  fileURLToPath(new URL('../migrations/0001_core_identity_lessons.sql', import.meta.url)),
  'utf8',
);

test('public health exposes no account or database details', async () => {
  const response = await worker.fetch(request('/healthz'), {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('readiness fails closed without a binding or when D1 fails', async () => {
  const missing = await worker.fetch(request('/readyz'), {});
  assert.equal(missing.status, 503);
  const broken = await worker.fetch(request('/readyz'), {
    DB: { prepare: () => ({ first: async () => { throw Error('private connection detail'); } }) },
  });
  assert.equal(broken.status, 503);
  assert.deepEqual(await broken.json(), { status: 'unavailable' });
  const ready = await worker.fetch(request('/readyz'), {
    DB: { prepare: (sql) => {
      assert.equal(sql, 'SELECT 1 AS ready');
      return { first: async () => ({ ready: 1 }) };
    } },
  });
  assert.equal(ready.status, 200);
});

test('protected paths reject forged identity, tokens and all methods', async () => {
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
    const response = await worker.fetch(request('/v1/learners/private', {
      method,
      headers: { 'x-account-id': 'owner-1', authorization: 'Bearer unverified' },
    }), {});
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'authentication_unavailable' });
  }
  assert.equal((await worker.fetch(request('/v1'), {})).status, 401);
  assert.equal((await worker.fetch(request('/v2/learners'), {})).status, 404);
});

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(migration);
  db.exec(migration);
  db.exec("INSERT INTO accounts(id) VALUES ('guardian-a'), ('guardian-b'), ('teacher');");
  db.exec("INSERT INTO learner_profiles(id, owner_account_id, label) VALUES ('a', 'guardian-a', 'Fixture A'), ('b', 'guardian-b', 'Fixture B');");
  db.exec("INSERT INTO teachers(account_id, qualified) VALUES ('teacher', 1);");
  db.exec("INSERT INTO teacher_assignments(learner_id, teacher_account_id) VALUES ('a', 'teacher');");
  db.exec("INSERT INTO lessons(id, learner_id, teacher_account_id, starts_at, ends_at) VALUES ('lesson-a', 'a', 'teacher', 1000, 2000);");
  return db;
}

test('D1 migration replays, enables foreign keys and preserves lesson ownership', () => {
  const db = database();
  try {
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
    assert.throws(() => db.exec("INSERT INTO lessons(id, learner_id, teacher_account_id, starts_at, ends_at) VALUES ('wrong', 'b', 'teacher', 1000, 2000);"), /FOREIGN KEY/);
    assert.throws(() => db.exec("INSERT INTO lessons(id, learner_id, teacher_account_id, starts_at, ends_at) VALUES ('bad-time', 'a', 'teacher', 2000, 1000);"), /CHECK/);
    db.exec("INSERT INTO annotation_events(id, lesson_id, learner_id, author_account_id, operation_id, layer, payload_json) VALUES ('event-1', 'lesson-a', 'a', 'teacher', 'op-1', 'teacher', '{}');");
    assert.throws(() => db.exec("INSERT INTO annotation_events(id, lesson_id, learner_id, author_account_id, operation_id, layer, payload_json) VALUES ('event-2', 'lesson-a', 'b', 'teacher', 'op-2', 'teacher', '{}');"), /FOREIGN KEY/);
    assert.throws(() => db.exec("INSERT INTO annotation_events(id, lesson_id, learner_id, author_account_id, operation_id, layer, payload_json) VALUES ('event-3', 'lesson-a', 'a', 'teacher', 'op-1', 'teacher', '{}');"), /UNIQUE/);
    assert.throws(() => db.exec("INSERT INTO annotation_events(id, lesson_id, learner_id, author_account_id, operation_id, layer, payload_json) VALUES ('event-4', 'lesson-a', 'a', 'teacher', 'op-4', 'teacher', 'not-json');"), /CHECK/);
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  } finally {
    db.close();
  }
});
