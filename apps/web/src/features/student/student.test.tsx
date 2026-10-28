import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StudentProvider } from './StudentContext';
import { StudentDashboard } from './StudentDashboard';
import { StudentSection } from './StudentSection';
import { DEMO_PROFILES, getMockLearnerSnapshot, readSessionDemoProfiles } from './mock-adapter';
import { isLearnerProfile, scopedSnapshot, validateGrade, validatePublishedReport } from './domain';

describe('learner-scoped mock adapter', () => {
  it('keeps sibling lessons, reports and approved tasks isolated', () => {
    for (const learner of DEMO_PROFILES) {
      const snapshot = getMockLearnerSnapshot(learner);
      expect(snapshot.lessons.every((item) => item.learnerId === learner.id)).toBe(true);
      expect(snapshot.tasks.every((item) => item.learnerId === learner.id && item.approvedByTeacher)).toBe(true);
      expect(snapshot.reports.every((item) => item.learnerId === learner.id && item.status === 'published')).toBe(true);
    }
    expect(getMockLearnerSnapshot(DEMO_PROFILES[0]!).reports).toEqual([]);
    expect(getMockLearnerSnapshot(DEMO_PROFILES[1]!).tasks).toHaveLength(2);
    expect(getMockLearnerSnapshot(DEMO_PROFILES[1]!).latestReport?.tajweed).toBeNull();
  });
  it('does not expose a different learner report or invent a missing score', () => {
    const snapshot = scopedSnapshot(DEMO_PROFILES[0]!, [], [], [{
      id: 'sample', learnerId: 'demo-active', lessonId: 'l', teacher: 'teacher',
      dateLabel: 'date', publishedAt: '2026-10-01', status: 'published',
      memorization: 10, recitation: 9, tajweed: null, memorizedAyat: 2,
      reviewedAyat: 2, summary: 'Different learner',
    }]);
    expect(snapshot.latestReport).toBeNull();
    expect(validateGrade(null)).toBe(true);
    expect(validateGrade(0)).toBe(true);
    expect(validateGrade(10)).toBe(true);
    expect(validateGrade(-1)).toBe(false);
    expect(validateGrade(11)).toBe(false);
    expect(validatePublishedReport({ learnerId: 'x', publishedAt: 'date', status: 'draft',
      memorization: 10, recitation: 10, tajweed: null })).toBe(false);
  });
  it('accepts only validated session-only profile names', () => {
    expect(readSessionDemoProfiles({ getItem: () => JSON.stringify(['طالب أول', 'طالب ثان']) }))
      .toMatchObject([{ id: 'session-learner-0' }, { id: 'session-learner-1' }]);
    expect(readSessionDemoProfiles({ getItem: () => 'bad-json' })).toEqual([]);
    expect(readSessionDemoProfiles({ getItem: () => JSON.stringify(['']) })).toEqual([]);
    expect(readSessionDemoProfiles({ getItem: () => JSON.stringify(Array(9).fill('x')) })).toEqual([]);
    expect(isLearnerProfile({ id: 'x', name: 'example', stage: 'paid', demo: true })).toBe(false);
  });
});
describe('student portal server rendering', () => {
  it('shows balanced schedule and practice without invented grades for new students', () => {
    const html = renderToStaticMarkup(<StudentProvider><StudentDashboard /></StudentProvider>);
    expect(html).toContain('الحصص والجدول');
    expect(html).toContain('الحفظ والمراجعة');
    expect(html).toContain('لم يُنشَر أي تقرير');
    expect(html).not.toContain('مسودة غير معتمدة');
  });
  it('shows progress empty states and verified Quran source requirement', () => {
    const progress = renderToStaticMarkup(<StudentProvider><StudentSection section="progress" /></StudentProvider>);
    const mushaf = renderToStaticMarkup(<StudentProvider><StudentSection section="mushaf" /></StudentProvider>);
    expect(progress).toContain('لا توجد تقارير منشورة');
    expect(mushaf).toContain('نص قرآني موثّق');
  });
});
