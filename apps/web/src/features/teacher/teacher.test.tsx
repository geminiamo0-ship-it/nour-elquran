import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {TeacherProvider} from './TeacherContext';
import {TeacherHome} from './TeacherHome';
import {TeacherSection} from './TeacherSection';
import {TEACHER_SECTION_SLUGS,canEditLearnerPlan,canStartLesson,
  canReportStudentAbsent,hasTeacherDelayEscalation,isGrade,shouldWarnOvertime,
  validAssignment,validReport,reportForLearner,nextTeachingSlot} from './domain';
import {DEMO_LEARNERS,DEMO_LESSONS,DEMO_REPORTS,demoScenario} from './fixtures';

describe('teacher workspace policy contracts',()=>{
  it('renders every approved teacher route as an Arabic RTL-ready component',()=>{
    const home=renderToStaticMarkup(<TeacherProvider><TeacherHome/></TeacherProvider>);
    expect(home).toContain('أهلًا بك في نور القرآن');
    expect(home).toContain('تقارير تحتاج الاعتماد');
    for(const page of TEACHER_SECTION_SLUGS){
      const html=renderToStaticMarkup(<TeacherProvider><TeacherSection section={page}/></TeacherProvider>);
      expect(html.length).toBeGreaterThan(400);
      expect(html).not.toContain('dangerouslySetInnerHTML');
    }
  });
  it('never treats absent participants as an authorized start',()=>{
    const lesson=DEMO_LESSONS[0]!;
    expect(canStartLesson(lesson)).toBe(true);
    expect(canStartLesson({...lesson,learnerPresent:false,elapsedLateMinutes:18})).toBe(false);
    expect(canStartLesson({...lesson,teacherPresent:false})).toBe(false);
    expect(canStartLesson({...lesson,status:'cancelled'})).toBe(false);
    expect(canStartLesson({...lesson,isSubstitute:true,guardianAccepted:false})).toBe(false);
    expect(canStartLesson({...lesson,isSubstitute:true,guardianAccepted:true})).toBe(true);
  });
  it('preserves student-late teacher discretion and teacher-late administrative escalation',()=>{
    const lateStudent=demoScenario('student-late').lessons[0]!;
    expect(lateStudent.elapsedLateMinutes).toBe(18);
    expect(canReportStudentAbsent(lateStudent)).toBe(true);
    expect(canStartLesson(lateStudent)).toBe(false);
    expect(canStartLesson({...lateStudent,learnerPresent:true})).toBe(true);
    const lateTeacher=demoScenario('teacher-late').lessons[0]!;
    expect(hasTeacherDelayEscalation(lateTeacher)).toBe(true);
    expect(canReportStudentAbsent(lateTeacher)).toBe(false);
  });
  it('overtime is only a warning; no automatic end action exists on the screen',()=>{
    const overdue=demoScenario('overtime').lessons[0]!;
    expect(shouldWarnOvertime(overdue)).toBe(true);
    expect(overdue.status).toBe('live');
    expect(shouldWarnOvertime({...overdue,status:'completed'})).toBe(false);
  });
  it('does not leak history or permit substitute to edit primary teacher plan',()=>{
    const primary=DEMO_LEARNERS.find(l=>l.primaryTeacher)!;
    const substitute=DEMO_LEARNERS.find(l=>!l.primaryTeacher)!;
    expect(canEditLearnerPlan(primary)).toBe(true);
    expect(canEditLearnerPlan(substitute)).toBe(false);
    expect(reportForLearner(DEMO_REPORTS,primary.id).every(r=>r.learnerId===primary.id)).toBe(true);
    expect(reportForLearner(DEMO_REPORTS,substitute.id)).toEqual([]);
  });
  it('leaves missing independent grades null and rejects invalid scores',()=>{
    expect(isGrade(null)).toBe(true);expect(isGrade(0)).toBe(true);expect(isGrade(10)).toBe(true);
    expect(isGrade(11)).toBe(false);expect(isGrade(2.5)).toBe(false);expect(isGrade(-1)).toBe(false);
    const report=DEMO_REPORTS[0]!;
    expect(report.tajweed).toBeNull();
    expect(validReport(report)).toBe(true);
    expect(validReport({...report,tajweed:11})).toBe(false);
    expect(validReport({...report,hifz:3.5})).toBe(false);
    expect(validReport({...report,scope:'x'.repeat(701)})).toBe(false);
  });
  it('rejects foreign learners, substitutes and noncanonical preview ayah ranges',()=>{
    const input={
      learnerIds:['demo-learner-1'],kind:'recitation' as const,surah:87,surahName:'الأعلى',
      fromAyah:1,toAyah:19,dueDate:'2026-10-31',
    };
    expect(validAssignment(input,DEMO_LEARNERS)).toBe(true);
    expect(validAssignment({...input,learnerIds:['other']},DEMO_LEARNERS)).toBe(false);
    expect(validAssignment({...input,learnerIds:['demo-substitute']},DEMO_LEARNERS)).toBe(false);
    expect(validAssignment({...input,toAyah:20},DEMO_LEARNERS)).toBe(false);
    expect(validAssignment({...input,learnerIds:['demo-learner-1','demo-learner-1']},DEMO_LEARNERS)).toBe(false);
  });
  it('shows genuine empty state and no invented teaching metrics for new teacher',()=>{
    const empty=demoScenario('empty');
    expect(empty.learners).toEqual([]);expect(empty.lessons).toEqual([]);
    expect(nextTeachingSlot(empty.lessons)).toBeNull();
    expect(nextTeachingSlot(DEMO_LESSONS)?.id).toBe('demo-lesson-1');
  });
  it('explains that report publication, LiveKit and WhatsApp are preview-only',()=>{
    const reports=renderToStaticMarkup(<TeacherProvider><TeacherSection section="reports"/></TeacherProvider>);
    const tasks=renderToStaticMarkup(<TeacherProvider><TeacherSection section="assignments"/></TeacherProvider>);
    const notifications=renderToStaticMarkup(<TeacherProvider><TeacherSection section="notifications"/></TeacherProvider>);
    expect(reports).toContain('اعتماد ونشر تجريبي');
    expect(tasks).toContain('التخزين الخاص');
    expect(notifications).toContain('لا توجد رسائل حقيقية');
  });
});
