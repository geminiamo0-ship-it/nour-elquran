import { validatePublishedReport, type LocalStudyNote, type PublishedReport } from './domain';
import { validTarget, type QuranAnnotation } from './quranAnnotations';
import { QURAN_EDITION, QURAN_VERSION, QURAN_PAGE_COUNT, isQuranReference, type QuranAyahRegion } from './quranSource';

/** These are *structural* anchors, not a substitute for verifying publisher page metadata. */
export type NotebookAnchor = Readonly<{ surah: number; ayah: number; page: number }>;
export type NotebookQuranScope = Readonly<{
  edition: typeof QURAN_EDITION;
  version: typeof QURAN_VERSION;
  start: NotebookAnchor;
  end: NotebookAnchor;
}>;
export type PublishedNotebookRevision = Readonly<{
  id: string;
  learnerId: string;
  lessonId: string;
  revision: number;
  publishedAt: string;
  report: PublishedReport;
  scope: NotebookQuranScope | null;
  approvedAnnotations: readonly QuranAnnotation[];
  archive: 'unavailable' | 'pending' | 'ready';
}>;

function validAnchor(value: unknown): value is NotebookAnchor {
  if (!isQuranReference(value)) return false;
  const anchor = value as NotebookAnchor;
  return anchor.ayah <= 286 && Number.isInteger(anchor.page) && anchor.page >= 1 && anchor.page <= QURAN_PAGE_COUNT;
}
function compareVerse(a: NotebookAnchor, b: NotebookAnchor): number {
  return a.surah === b.surah ? a.ayah - b.ayah : a.surah - b.surah;
}

/** Accepts cross-surah and cross-page lesson ranges without guessing their verse-to-page mapping. */
export function structurallyValidNotebookScope(value: unknown): value is NotebookQuranScope {
  if (!value || typeof value !== 'object') return false;
  const scope = value as Partial<NotebookQuranScope>;
  return scope.edition === QURAN_EDITION && scope.version === QURAN_VERSION &&
    validAnchor(scope.start) && validAnchor(scope.end) &&
    compareVerse(scope.start, scope.end) <= 0 && scope.start.page <= scope.end.page;
}

export function scopeContainsAnnotation(scope: NotebookQuranScope, annotation: QuranAnnotation): boolean {
  if (!structurallyValidNotebookScope(scope) || !validTarget(annotation.target)) return false;
  const anchor = annotation.target;
  return anchor.page >= scope.start.page && anchor.page <= scope.end.page &&
    compareVerse(anchor, scope.start) >= 0 && compareVerse(anchor, scope.end) <= 0;
}

/** Never use a revision or annotation from another learner, lesson or draft. */
export function latestPublishedNotebook(
  revisions: readonly PublishedNotebookRevision[], learnerId: string, lessonId: string,
): PublishedNotebookRevision | null {
  const selected = revisions.filter((revision) =>
    revision.learnerId === learnerId && revision.lessonId === lessonId &&
    !!revision.id && Number.isSafeInteger(revision.revision) && revision.revision > 0 &&
    Number.isFinite(Date.parse(revision.publishedAt)) &&
    revision.report.learnerId === learnerId && revision.report.lessonId === lessonId &&
    validatePublishedReport(revision.report) &&
    (revision.scope === null || structurallyValidNotebookScope(revision.scope))
  ).sort((a, b) => b.revision - a.revision || b.publishedAt.localeCompare(a.publishedAt))[0];
  return selected ? { ...selected, approvedAnnotations: publishedLessonAnnotations(selected) } : null;
}

/** Read-only approved layer; private/other-lesson marks never enter it. */
export function publishedLessonAnnotations(revision: PublishedNotebookRevision): QuranAnnotation[] {
  if (!revision.scope) return [];
  return revision.approvedAnnotations.filter((annotation) =>
    annotation.type === 'teacher' && annotation.published &&
    annotation.learnerId === revision.learnerId && annotation.lessonId === revision.lessonId &&
    scopeContainsAnnotation(revision.scope!, annotation)
  );
}
export function personalLessonNotes(
  notes: readonly LocalStudyNote[], learnerId: string, lessonId: string,
): LocalStudyNote[] {
  return notes.filter((note) => note.learnerId === learnerId && note.lessonId === lessonId);
}

/** Current report-only mock has no published notebook revisions. Always select the newest valid report. */
export function latestLessonReport(
  reports: readonly PublishedReport[], learnerId: string, lessonId: string,
): PublishedReport | null {
  return reports.filter((report) =>
    report.learnerId === learnerId && report.lessonId === lessonId &&
    typeof report.id === 'string' && report.id.length > 0 &&
    validatePublishedReport(report) && Number.isFinite(Date.parse(report.publishedAt))
  ).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0] ?? null;
}

/**
 * Confirm the visible lesson verses against this page's actual publisher sidecar.
 * Boundary anchors must occur on their declared pages. Never guess verse positions.
 * A null result means the page must not display a claimed teacher-approved range.
 */
export function pageKeysForNotebookScope(
  scope: NotebookQuranScope, page: number, regions: readonly QuranAyahRegion[],
): ReadonlySet<string> | null {
  if (!structurallyValidNotebookScope(scope) || !Number.isInteger(page) ||
      page < scope.start.page || page > scope.end.page || !Array.isArray(regions)) return null;
  const valid = regions.filter((region) => isQuranReference(region) && region.ayah <= 286);
  const matches = (region: QuranAyahRegion, anchor: NotebookAnchor) =>
    region.surah === anchor.surah && region.ayah === anchor.ayah;
  if (page === scope.start.page && !valid.some((region) => matches(region, scope.start))) return null;
  if (page === scope.end.page && !valid.some((region) => matches(region, scope.end))) return null;
  const included = valid.filter((region) =>
    compareVerse(region, scope.start) >= 0 && compareVerse(region, scope.end) <= 0);
  return included.length ? new Set(included.map((region) => region.surah + ':' + region.ayah)) : null;
}
