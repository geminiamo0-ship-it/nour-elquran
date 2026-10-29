import { describe, expect, it } from 'vitest';
import { QURAN_EDITION, QURAN_VERSION } from './quranSource';
import type { PublishedReport, LocalStudyNote } from './domain';
import type { QuranAnnotation } from './quranAnnotations';
import {
  structurallyValidNotebookScope, scopeContainsAnnotation, latestPublishedNotebook,
  publishedLessonAnnotations, personalLessonNotes, latestLessonReport,
  type NotebookQuranScope, type PublishedNotebookRevision,
} from './notebookContracts';

const scope: NotebookQuranScope = {
  edition: QURAN_EDITION, version: QURAN_VERSION,
  start: { surah: 112, ayah: 3, page: 604 },
  end: { surah: 114, ayah: 2, page: 604 },
};
const report: PublishedReport = {
  id: 'r1', learnerId: 'a', lessonId: 'l1', teacher: 'شيخ تجريبي',
  dateLabel: 'مثال', publishedAt: '2026-10-20T12:00:00Z', status: 'published',
  memorization: 8, recitation: null, tajweed: 7, memorizedAyat: null,
  reviewedAyat: null, summary: 'مثال توضيحي',
};
const annotation: QuranAnnotation = {
  id: 'mark', learnerId: 'a', lessonId: 'l1', type: 'teacher', published: true,
  authorLabel: 'شيخ تجريبي', target: { page: 604, surah: 113, ayah: 1, wordIndex: null },
  text: 'مثال', color: '#123456', createdAt: '2026-10-20T12:00:00Z',
};
function revision(n: number): PublishedNotebookRevision {
  return { id: 'rev' + n, learnerId: 'a', lessonId: 'l1', revision: n,
    publishedAt: '2026-10-20T12:00:00Z', report, scope,
    approvedAnnotations: [annotation], archive: 'unavailable' };
}
describe('notebook publication and learner isolation contracts (#102)', () => {
  it('supports cross-surah lesson ranges but rejects reversed, invalid-page or wrong-edition scopes', () => {
    expect(structurallyValidNotebookScope(scope)).toBe(true);
    expect(structurallyValidNotebookScope({ ...scope, end: { surah: 111, ayah: 1, page: 604 } })).toBe(false);
    expect(structurallyValidNotebookScope({ ...scope, end: { surah: 114, ayah: 2, page: 605 } })).toBe(false);
    expect(structurallyValidNotebookScope({ ...scope, edition: 'unknown' })).toBe(false);
    expect(structurallyValidNotebookScope({ ...scope, start: { surah: 112, ayah: 3, page: 605 } })).toBe(false);
  });
  it('limits published teacher marks to the exact learner, lesson, and verse scope', () => {
    expect(scopeContainsAnnotation(scope, annotation)).toBe(true);
    expect(scopeContainsAnnotation(scope, { ...annotation, target: { ...annotation.target, surah: 111 } })).toBe(false);
    const marks = publishedLessonAnnotations({
      ...revision(2), approvedAnnotations: [
        annotation, { ...annotation, id: 'private', type: 'private' },
        { ...annotation, id: 'other-learner', learnerId: 'b' },
        { ...annotation, id: 'other-lesson', lessonId: 'l2' },
        { ...annotation, id: 'draft', published: false },
        { ...annotation, id: 'outside', target: { page: 604, surah: 114, ayah: 3, wordIndex: null } },
      ],
    });
    expect(marks.map((mark) => mark.id)).toEqual(['mark']);
    expect(publishedLessonAnnotations({ ...revision(1), scope: null })).toEqual([]);
  });
  it('only returns latest published valid revision for the selected learner and lesson', () => {
    const latest = latestPublishedNotebook([
      revision(1), revision(2), { ...revision(3), learnerId: 'b' },
      { ...revision(4), report: { ...report, lessonId: 'l2' } },
      { ...revision(5), scope: { ...scope, edition: 'wrong' as typeof QURAN_EDITION } },
    ], 'a', 'l1');
    expect(latest?.revision).toBe(2);
    expect(latestPublishedNotebook([revision(1)], 'b', 'l1')).toBeNull();
    expect(latestPublishedNotebook([revision(1)], 'a', 'l2')).toBeNull();
    expect(latestPublishedNotebook([], 'a', 'l1')).toBeNull();
  });
  it('keeps private notes separate across siblings and lessons', () => {
    const notes: LocalStudyNote[] = [
      { id: 'n1', learnerId: 'a', lessonId: 'l1', text: 'خاص', createdAt: '2026-10-20' },
      { id: 'n2', learnerId: 'b', lessonId: 'l1', text: 'آخر', createdAt: '2026-10-20' },
      { id: 'n3', learnerId: 'a', lessonId: 'l2', text: 'حصة أخرى', createdAt: '2026-10-20' },
    ];
    expect(personalLessonNotes(notes, 'a', 'l1').map((note) => note.id)).toEqual(['n1']);
  });
  it('shows only newest report, keeps independent nullable grades and never fabricates pending reports', () => {
    const old = { ...report, id: 'old', publishedAt: '2026-10-19T12:00:00Z' };
    const latest = latestLessonReport([old, { ...report, learnerId: 'b' }, report], 'a', 'l1');
    expect(latest?.id).toBe('r1');
    expect(latest?.recitation).toBeNull();
    expect(latestLessonReport([report], 'a', 'l2')).toBeNull();
    expect(latestLessonReport([], 'a', 'l1')).toBeNull();
  });
});
