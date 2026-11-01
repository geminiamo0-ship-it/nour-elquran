import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StudentProvider } from './StudentContext';
import { StudentSection } from './StudentSection';
import { latestPublishedReports, REPORTS_PAGE_SIZE, nextReportCount } from './reportHistory';
import type { PublishedReport } from './domain';

function report(id: string, lessonId: string, learnerId: string, publishedAt: string): PublishedReport {
  return { id, lessonId, learnerId, publishedAt, teacher: 'شيخ مثال', dateLabel: 'حصة مثال',
    status:'published', memorization:8, recitation:null, tajweed:0,
    memorizedAyat:4, reviewedAyat:null, summary:'ملخص موثق للتجربة' };
}

describe('academic reports: approved premium card specification', () => {
  it('keeps just the latest published revision per lesson and selected learner', () => {
    const rows = latestPublishedReports([
      report('old','a','one','2026-10-01T10:00:00Z'),
      report('other','z','two','2026-10-04T10:00:00Z'),
      report('b','b','one','2026-10-02T10:00:00Z'),
      report('new','a','one','2026-10-03T10:00:00Z'),
    ],'one');
    expect(rows.map((x)=>x.id)).toEqual(['new','b']);
    expect(rows[0]?.recitation).toBeNull();
    expect(rows[0]?.tajweed).toBe(0);
  });
  it('sorts deterministic date ties and paginates in chunks of five', () => {
    const rows=latestPublishedReports([
      report('y','y','one','2026-10-01T10:00:00Z'),
      report('a','a','one','2026-10-01T10:00:00Z'),
    ],'one');
    expect(rows.map((x)=>x.lessonId)).toEqual(['a','y']);
    expect(REPORTS_PAGE_SIZE).toBe(5);
    expect(nextReportCount(5,14)).toBe(10);
    expect(nextReportCount(10,14)).toBe(14);
    expect(nextReportCount(0,0)).toBe(0);
  });
  it('renders the clean reports hub without fake charts or filters', () => {
    const html=renderToStaticMarkup(<StudentProvider><StudentSection section="progress" /></StudentProvider>);
    expect(html).toContain('تقارير الشيخ');
    expect(html).toContain('لا توجد تقارير منشورة');
    expect(html).not.toContain('تصفية التقارير');
    expect(html).not.toContain('<canvas');
  });
});
