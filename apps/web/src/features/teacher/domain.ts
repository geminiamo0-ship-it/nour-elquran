/** Sheikh workspace DTOs and pure presentation rules (#11–#19, #120).
 * All writes here are explicitly preview-only; production commands must go to
 * authorized Worker APIs and must not trust the client-provided teacher role.
 */
export type TeacherSectionName = 'students' | 'schedule' | 'preparation' | 'reports' | 'assignments' | 'notifications' | 'cases';
export const TEACHER_SECTION_SLUGS: readonly TeacherSectionName[] = [
  'students', 'schedule', 'preparation', 'reports', 'assignments', 'notifications', 'cases',
];
export const teacherSections: Readonly<Record<TeacherSectionName, string>> = {
  students: 'طلابي', schedule: 'جدولي', preparation: 'تحضير الحصة',
  reports: 'تقارير الحصص', assignments: 'الواجبات والتسميعات',
  notifications: 'الإشعارات', cases: 'الحضور والمتابعة',
};
export type Scenario = 'normal' | 'empty' | 'student-late' | 'teacher-late' | 'disconnect' | 'overtime' | 'substitute';
export const SCENARIOS: readonly {id: Scenario; label: string}[] = [
  {id:'normal',label:'اليوم الطبيعي'}, {id:'empty',label:'شيخ جديد بلا طلاب'},
  {id:'student-late',label:'الطالب متأخر أكثر من 15 دقيقة'},
  {id:'teacher-late',label:'الشيخ متأخر أكثر من 10 دقائق'},
  {id:'disconnect',label:'انقطاع الاتصال أثناء الحصة'},
  {id:'overtime',label:'تجاوز موعد الحصة التالية'},
  {id:'substitute',label:'شيخ بديل بعد موافقة ولي الأمر'},
];
export type LessonStatus = 'scheduled' | 'waiting' | 'live' | 'completed' | 'cancelled';
export type LessonKind = 'trial' | 'standard' | 'makeup';
export interface TeacherLesson {
  id: string; learnerId: string; day: string; date: string; startsAt: string;
  /** Reserved occupancy; 40 minutes even if teaching entitlement is 30m. */
  reservedUntil: string; kind: LessonKind; status: LessonStatus;
  isSubstitute: boolean; guardianAccepted: boolean;
  teacherPresent: boolean; learnerPresent: boolean; elapsedLateMinutes: number;
  reportId?: string;
}
export interface TeacherLearner {
  id: string; name: string; level: string; lastSession: string;
  nextWird: string; revision: string; focus: string;
  latestScores: Readonly<{ hifz: number | null; recitation: number | null; tajweed: number | null }>;
  primaryTeacher: boolean; nextLessonId?: string;
}
export type ReportStatus = 'draft' | 'published';
export interface LessonReport {
  id: string; lessonId: string; learnerId: string; status: ReportStatus;
  scope: string; strengths: string; corrections: string; nextPlan: string;
  hifz: number | null; recitation: number | null; tajweed: number | null;
  revision: number; publishedRevision: number | null;
}
export type AssignmentKind = 'memorization' | 'revision' | 'recitation' | 'tajweed';
export type AssignmentStatus = 'assigned' | 'awaiting-review' | 'completed' | 'retry-requested';
export interface TeacherAssignment {
  id: string; learnerId: string; kind: AssignmentKind; surah: number;
  surahName: string; fromAyah: number; toAyah: number; dueDate: string;
  status: AssignmentStatus; attempt: number; feedback: string;
}
export interface TeacherNotice { id: string; text: string; detail: string; section: TeacherSectionName; read: boolean; }
export interface TeacherIncident { id: string; lessonId: string; label: string; detail: string; status: 'pending'|'resolved'; kind: 'student-absence'|'teacher-delay'|'connection'|'conflict'; }
export interface AssignmentInput {
  learnerIds: string[]; kind: AssignmentKind; surah: number; surahName: string;
  fromAyah: number; toAyah: number; dueDate: string;
}
export const KIND_LABEL: Readonly<Record<LessonKind, string>> = {
  trial: 'حصة تجريبية', standard: 'حصة أساسية', makeup: 'حصة تعويضية',
};
export const TASK_LABEL: Readonly<Record<AssignmentKind, string>> = {
  memorization: 'حفظ جديد', revision: 'مراجعة', recitation: 'تسميع', tajweed: 'تجويد',
};
export const LESSON_LABEL: Readonly<Record<LessonStatus, string>> = {
  scheduled:'قادمة',waiting:'غرفة انتظار',live:'مباشرة',completed:'مكتملة',cancelled:'ملغاة',
};
export function isGrade(value: number | null): boolean {
  return value === null || (Number.isInteger(value) && value >= 0 && value <= 10);
}
export function validReport(report: LessonReport): boolean {
  return isGrade(report.hifz) && isGrade(report.recitation) && isGrade(report.tajweed)
    && report.scope.length <= 700 && report.strengths.length <= 1000
    && report.corrections.length <= 1000 && report.nextPlan.length <= 1000;
}
/** Only preview fixture chapters are selectable; full edition/ayah verification is server-side. */
const PREVIEW_AYAH_MAX: Readonly<Record<number,number>> = {78:40,87:19,75:40,67:30,1:7};
export function validAssignment(input: AssignmentInput, permitted: readonly TeacherLearner[]): boolean {
  return !!input.learnerIds.length && input.learnerIds.length <= 30
    && new Set(input.learnerIds).size === input.learnerIds.length
    && input.learnerIds.every(id => permitted.some(learner => learner.id === id && learner.primaryTeacher))
    && Number.isInteger(input.surah) && input.surah >= 1 && input.surah <= 114
    && Number.isInteger(input.fromAyah) && input.fromAyah >= 1
    && Number.isInteger(input.toAyah) && input.toAyah >= input.fromAyah
    && input.toAyah <= (PREVIEW_AYAH_MAX[input.surah]??0) && !!input.surahName.trim()
    && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)
    && ['memorization','revision','recitation','tajweed'].includes(input.kind);
}
export function canEditLearnerPlan(learner: TeacherLearner): boolean {
  return learner.primaryTeacher; // Substitutes only receive the accepted lesson-specific brief.
}
export function canStartLesson(lesson: TeacherLesson): boolean {
  return (lesson.status === 'waiting' || lesson.status === 'scheduled')
    && lesson.teacherPresent && lesson.learnerPresent
    && (!lesson.isSubstitute || lesson.guardianAccepted);
}
export function canReportStudentAbsent(lesson: TeacherLesson): boolean {
  return lesson.status !== 'completed' && lesson.status !== 'cancelled'
    && !lesson.learnerPresent && lesson.elapsedLateMinutes >= 15;
}
export function hasTeacherDelayEscalation(lesson: TeacherLesson): boolean {
  return !lesson.teacherPresent && lesson.elapsedLateMinutes >= 10;
}
export function shouldWarnOvertime(lesson: TeacherLesson): boolean {
  return lesson.status === 'live' && lesson.elapsedLateMinutes >= 40;
}
export function reportForLearner(reports: readonly LessonReport[], learnerId: string): LessonReport[] {
  return reports.filter(r => r.learnerId === learnerId);
}
export function nextTeachingSlot(lessons: readonly TeacherLesson[]): TeacherLesson | null {
  return lessons.find(l => l.status === 'waiting' || l.status === 'scheduled' || l.status === 'live') ?? null;
}
