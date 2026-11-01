import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StudentProvider } from './StudentContext';
import { StudentDashboard } from './StudentDashboard';
import { StudentSection } from './StudentSection';
import { ConnectedClassroomLessons } from './components/ConnectedClassroomLessons';
import { DEMO_PROFILES, getMockLearnerSnapshot, readSessionDemoProfiles } from './mock-adapter';
import { isLearnerProfile, sanitizeStudyNote, scopedSnapshot, validateGrade, validatePublishedReport } from './domain';

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

describe('local student workflows and safe page components', () => {
  it('accepts only bounded personal notes', () => {
    expect(sanitizeStudyNote('  مراجعة سورة الإخلاص  ')).toBe('مراجعة سورة الإخلاص');
    expect(sanitizeStudyNote('')).toBeNull();
    expect(sanitizeStudyNote('a'.repeat(501))).toBeNull();
  });
  it('renders every standalone learner page without a connected backend', () => {
    for (const page of ['lessons', 'mushaf', 'training', 'progress',
      'notebook', 'subscription', 'account'] as const) {
      const html = renderToStaticMarkup(<StudentProvider><StudentSection section={page} /></StudentProvider>);
      expect(html.length).toBeGreaterThan(100);
      expect(html).not.toContain('dangerouslySetInnerHTML');
      expect(html).not.toContain('مبلغ مستحق');
    }
  });
  it('shows genuine blank states on new learner and separates practice preparation from submission', () => {
    const training = renderToStaticMarkup(<StudentProvider><StudentSection section="training" /></StudentProvider>);
    const notebook = renderToStaticMarkup(<StudentProvider><StudentSection section="notebook" /></StudentProvider>);
    expect(training).toContain('اختر سورة وابدأ');
    expect(training).not.toContain('مسودة غير معتمدة');
    expect(notebook).toContain('لا توجد حصص مكتملة');
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


describe('connected learner isolation', () => {
  it('never loads demo lessons, teachers, grades or profiles for a real account', () => {
    const html = renderToStaticMarkup(<StudentProvider liveLearners={[{
      id: '10b4e832-c325-4da9-8cff-e1f10d209156', name: 'Connected learner', stage: 'new', demo: false,
    }]}><StudentDashboard /></StudentProvider>);
    expect(html).toContain('Connected learner');
    // Server render has no authenticated API response yet. A genuine loading
    // state is required; an invented empty-report result would be misleading.
    expect(html).toContain('جارٍ تحميل بيانات الطالب الموثقة');
    expect(html).not.toContain('لم يُنشَر أي تقرير');
    expect(html).not.toContain('شيخ تجريبي');
    expect(html).not.toContain('طالبة منتظمة');
    expect(html).not.toContain('8 / 10');
  });
});


describe('connected trial lessons server boundary (#244)', () => {
  it('renders real signed loading states rather than a local booking preview', () => {
    const html = renderToStaticMarkup(<ConnectedClassroomLessons learnerId="synthetic-child" />);
    expect(html).toContain('جارٍ تحميل مواعيدك');
    expect(html).toContain('حجز حصة تجريبية');
    expect(html).not.toContain('جارٍ التحقق من استحقاق التجربة والمواعيد');
    expect(html).not.toContain('معاينة طلب حصة تجريبية');
    expect(html).not.toContain('حصة تجريبية مدرجة كمثال');
  });
});
