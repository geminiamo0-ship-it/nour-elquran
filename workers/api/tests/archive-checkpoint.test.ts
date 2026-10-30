import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  ArchiveCheckpointError, digestArchiveCheckpoint, parseArchiveCheckpoint,
  verifyArchiveCheckpoint, type ExpectedArchiveScope,
} from '../src/classroom/archive-checkpoint.ts';

const expected: ExpectedArchiveScope = {
  lessonId: 'lesson-a', learnerId: 'learner-a', actingTeacherId: 'teacher-a',
  editionId: 'hafs-kfqc:v1.1.1', manifestSha256: 'a'.repeat(64),
};
const valid = () => ({
  schemaVersion: 1, ...expected, startedAtMs: 1000, endedAtMs: 5000,
  pages: [1, 2], marks: [
    { eventId: 'e1', sequence: 1, atMs: 2000, authorRole: 'teacher',
      authorTeacherId: 'teacher-a', page: 1, kind: 'note', surah: 1, ayah: 1,
      payload: { color: '#ABCDEF', text: 'راجع المد' } },
    { eventId: 'e2', sequence: 3, atMs: 3000, authorRole: 'teacher',
      authorTeacherId: 'teacher-a', page: 2, kind: 'pen', surah: null, ayah: null,
      payload: { color: '#000000', width: 3, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] } },
  ],
});
const invalid = (mutate: (v: ReturnType<typeof valid>) => void) => {
  const v = valid(); mutate(v);
  assert.throws(() => parseArchiveCheckpoint(v, expected), ArchiveCheckpointError);
};

test('canonical checkpoint digest is deterministic and verifies independently', async () => {
  const parsed = parseArchiveCheckpoint(valid(), expected);
  assert.equal(parsed.marks[0]?.payload.color, '#abcdef');
  const digest = await digestArchiveCheckpoint(parsed);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.deepEqual(await verifyArchiveCheckpoint(valid(), expected, digest), parsed);
  await assert.rejects(verifyArchiveCheckpoint(valid(), expected, '0'.repeat(64)), ArchiveCheckpointError);
  const tampered = valid(); tampered.marks[0]!.payload = { color: '#abcdef', text: 'changed' };
  await assert.rejects(verifyArchiveCheckpoint(tampered, expected, digest), ArchiveCheckpointError);
});

test('rejects forged scope, student marks, stale/reordered/duplicate events', () => {
  invalid(v => { v.learnerId = 'sibling'; });
  invalid(v => { v.manifestSha256 = 'b'.repeat(64); });
  invalid(v => { v.marks[0]!.authorRole = 'student'; });
  invalid(v => { v.marks[0]!.authorTeacherId = 'teacher-b'; });
  invalid(v => { v.marks[1]!.eventId = 'e1'; });
  invalid(v => { v.marks[1]!.sequence = 1; });
  invalid(v => { v.marks[0]!.atMs = 6000; });
  invalid(v => { v.pages = [2, 1]; });
  invalid(v => { v.pages = [1, 1]; });
  invalid(v => { v.marks[1]!.page = 3; });
});

test('rejects forged payloads, unexpected keys and invalid coordinates', () => {
  invalid(v => { v.marks[0]!.payload = { color: '#abcdef', text: '' }; });
  invalid(v => { v.marks[1]!.payload = { color: '#000000', width: 3, points: [{ x: 0, y: 0 }, { x: 1001, y: 0 }] }; });
  invalid(v => { v.marks[1]!.payload = { color: '#000000', width: 3, points: [{ x: 0, y: 0 }] }; });
  invalid(v => { v.marks[0]!.surah = null; });
  invalid(v => { v.marks[1]!.ayah = 1; });
  invalid(v => { Object.assign(v.marks[0]!, { accountId: 'foreign' }); });
  invalid(v => { Object.assign(v.marks[0]!.payload, { extra: true }); });
  invalid(v => { v.marks = Array.from({ length: 101 }, (_, i) => ({ ...v.marks[0]!, eventId: 'e' + i, sequence: i + 1 })); });
});
