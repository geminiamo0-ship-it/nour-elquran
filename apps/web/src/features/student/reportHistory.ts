import type { PublishedReport } from './domain';
import { validatePublishedReport } from './domain';

export const REPORTS_PAGE_SIZE = 5;

/** Show exactly the most recent approved revision per lesson and selected learner. */
export function latestPublishedReports(
  reports: readonly PublishedReport[], learnerId: string,
): PublishedReport[] {
  const byLesson = new Map<string, PublishedReport>();
  for (const report of reports) {
    if (report.learnerId !== learnerId || !validatePublishedReport(report) || !report.lessonId) continue;
    const current = byLesson.get(report.lessonId);
    if (!current || compareReports(report, current) < 0) byLesson.set(report.lessonId, report);
  }
  return [...byLesson.values()].sort(compareReports);
}

/** Stable newest-first chronology, deterministic even when two reports have the same timestamp. */
function compareReports(a: PublishedReport, b: PublishedReport): number {
  return b.publishedAt.localeCompare(a.publishedAt)
    || a.lessonId.localeCompare(b.lessonId)
    || a.id.localeCompare(b.id);
}

export function nextReportCount(current: number, total: number): number {
  return Math.min(total, Math.max(0, current) + REPORTS_PAGE_SIZE);
}
