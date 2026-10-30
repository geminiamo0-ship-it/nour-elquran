/**
 * Phase 08B2 (#194): deterministic, bounded LessonDO archive checkpoint contract.
 * This is NOT a Durable Object, an identity verifier, a D1 writer or a public API.
 * Callers must independently authenticate the DO binding, signed acting Sheikh,
 * actual participant presence and D1 END/report/edition provenance before sealing.
 */
export const ARCHIVE_CHECKPOINT_VERSION = 1;
const MAX_PAGES = 20;
const MAX_MARKS = 100;
const MAX_CHECKPOINT_BYTES = 512 * 1024;
const HEX_SHA256 = /^[0-9a-f]{64}$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

type ArchiveKind = 'note' | 'highlight' | 'pen' | 'marker';
type Point = Readonly<{ x: number; y: number }>;
type NotePayload = Readonly<{ color: string; text: string }>;
type HighlightPayload = Readonly<{ color: string }>;
type InkPayload = Readonly<{ color: string; width: number; points: readonly Point[] }>;

export type CheckpointMark = Readonly<{
  eventId: string;
  sequence: number;
  atMs: number;
  authorRole: 'teacher';
  authorTeacherId: string;
  page: number;
  kind: ArchiveKind;
  surah: number | null;
  ayah: number | null;
  payload: NotePayload | HighlightPayload | InkPayload;
}>;

export type ArchiveCheckpoint = Readonly<{
  schemaVersion: 1;
  lessonId: string;
  learnerId: string;
  actingTeacherId: string;
  editionId: string;
  manifestSha256: string;
  startedAtMs: number;
  endedAtMs: number;
  pages: readonly number[];
  marks: readonly CheckpointMark[];
}>;

/** Trusted expected scope must be obtained from server-side D1 and signed session. */
export type ExpectedArchiveScope = Readonly<{
  lessonId: string;
  learnerId: string;
  actingTeacherId: string;
  editionId: string;
  manifestSha256: string;
}>;

export class ArchiveCheckpointError extends Error {
  constructor() { super('INVALID_ARCHIVE_CHECKPOINT'); this.name = 'ArchiveCheckpointError'; }
}

function reject(): never { throw new ArchiveCheckpointError(); }
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return reject();
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(value).some(key => !keys.includes(key))) reject();
}
function id(value: unknown): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 128 ||
      !/^[a-zA-Z0-9:._-]+$/.test(value)) return reject();
  return value;
}
function int(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) return reject();
  return value;
}
function finite(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return reject();
  return value;
}
function color(value: unknown): string {
  if (typeof value !== 'string' || !HEX_COLOR.test(value)) return reject();
  return value.toLowerCase();
}
function sha(value: unknown): string {
  if (typeof value !== 'string' || !HEX_SHA256.test(value)) return reject();
  return value;
}
function payloadFor(kind: ArchiveKind, value: unknown): NotePayload | HighlightPayload | InkPayload {
  const p = record(value);
  if (kind === 'note') {
    exactKeys(p, ['color', 'text']);
    if (typeof p.text !== 'string' || p.text.trim().length < 1 || p.text.length > 500) reject();
    return { color: color(p.color), text: p.text };
  }
  if (kind === 'highlight') {
    exactKeys(p, ['color']);
    return { color: color(p.color) };
  }
  exactKeys(p, ['color', 'width', 'points']);
  if (!Array.isArray(p.points) || p.points.length < 2 || p.points.length > 2500) reject();
  const points: Point[] = p.points.map((value: unknown) => {
    const point = record(value);
    exactKeys(point, ['x', 'y']);
    return { x: finite(point.x, 0, 1000), y: finite(point.y, 0, 1594) };
  });
  return { color: color(p.color), width: finite(p.width, 1, 60), points };
}

/**
 * Validate a persisted, ordered teacher-only DO snapshot without trusting TS types.
 * Sequence gaps are allowed (other DO events may exist), but replay/reorder is not.
 * No Quran ayah/page anchor is independently verified here; D1 must do that.
 */
export function parseArchiveCheckpoint(input: unknown, expected: ExpectedArchiveScope): ArchiveCheckpoint {
  const raw = record(input);
  exactKeys(raw, ['schemaVersion', 'lessonId', 'learnerId', 'actingTeacherId',
    'editionId', 'manifestSha256', 'startedAtMs', 'endedAtMs', 'pages', 'marks']);
  if (raw.schemaVersion !== ARCHIVE_CHECKPOINT_VERSION) reject();
  const lessonId = id(raw.lessonId);
  const learnerId = id(raw.learnerId);
  const actingTeacherId = id(raw.actingTeacherId);
  const editionId = id(raw.editionId);
  const manifestSha256 = sha(raw.manifestSha256);
  if (lessonId !== expected.lessonId || learnerId !== expected.learnerId ||
      actingTeacherId !== expected.actingTeacherId || editionId !== expected.editionId ||
      manifestSha256 !== expected.manifestSha256 || !HEX_SHA256.test(expected.manifestSha256)) reject();
  const startedAtMs = int(raw.startedAtMs, 0, Number.MAX_SAFE_INTEGER);
  const endedAtMs = int(raw.endedAtMs, startedAtMs, Number.MAX_SAFE_INTEGER);
  if (!Array.isArray(raw.pages) || raw.pages.length < 1 || raw.pages.length > MAX_PAGES) reject();
  const pages: number[] = raw.pages.map((value: unknown) => int(value, 1, 604));
  if (pages.some((page, index) => index > 0 && page <= pages[index - 1]!)) reject();
  if (!Array.isArray(raw.marks) || raw.marks.length > MAX_MARKS) reject();
  const ids = new Set<string>();
  let lastSequence = 0;
  const marks: CheckpointMark[] = raw.marks.map((value: unknown) => {
    const mark = record(value);
    exactKeys(mark, ['eventId', 'sequence', 'atMs', 'authorRole', 'authorTeacherId',
      'page', 'kind', 'surah', 'ayah', 'payload']);
    const eventId = id(mark.eventId);
    const sequence = int(mark.sequence, 1, Number.MAX_SAFE_INTEGER);
    if (ids.has(eventId) || sequence <= lastSequence) reject();
    ids.add(eventId);
    lastSequence = sequence;
    const atMs = int(mark.atMs, startedAtMs, endedAtMs);
    if (mark.authorRole !== 'teacher' || id(mark.authorTeacherId) !== actingTeacherId) reject();
    const page = int(mark.page, 1, 604);
    if (!pages.includes(page)) reject();
    const kind = mark.kind;
    if (kind !== 'note' && kind !== 'highlight' && kind !== 'pen' && kind !== 'marker') reject();
    const anchored = kind === 'note' || kind === 'highlight';
    const surah = anchored ? int(mark.surah, 1, 114) : null;
    const ayah = anchored ? int(mark.ayah, 1, 999) : null;
    if (!anchored && (mark.surah !== null || mark.ayah !== null)) reject();
    const payload = payloadFor(kind, mark.payload);
    if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > 110000) reject();
    return { eventId, sequence, atMs, authorRole: 'teacher', authorTeacherId: actingTeacherId,
      page, kind, surah, ayah, payload };
  });
  const checkpoint: ArchiveCheckpoint = { schemaVersion: 1, lessonId, learnerId,
    actingTeacherId, editionId, manifestSha256, startedAtMs, endedAtMs, pages, marks };
  if (new TextEncoder().encode(JSON.stringify(checkpoint)).byteLength > MAX_CHECKPOINT_BYTES) reject();
  return checkpoint;
}

/** Digest the normalized JSON bytes; only a separately authenticated DO can attest provenance. */
export async function digestArchiveCheckpoint(checkpoint: ArchiveCheckpoint): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(checkpoint));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

export async function verifyArchiveCheckpoint(input: unknown, expected: ExpectedArchiveScope,
  claimedSha256: unknown): Promise<ArchiveCheckpoint> {
  const checkpoint = parseArchiveCheckpoint(input, expected);
  if (await digestArchiveCheckpoint(checkpoint) !== sha(claimedSha256)) reject();
  return checkpoint;
}
