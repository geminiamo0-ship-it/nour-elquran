/** Deliberately synthetic, explicitly marked teaching preview.
 * Nothing in this module is sent to APIs, localStorage or sessionStorage.
 */
import type { TeacherLearner, TeacherLesson, LessonReport, TeacherAssignment, TeacherNotice, TeacherIncident, Scenario } from './domain';

export const DEMO_LEARNERS: readonly TeacherLearner[] = [
  {id:'demo-learner-1',name:'طالب تجريبي أ',level:'حفظ الجزء الثلاثين',lastSession:'الحصة السابقة',nextWird:'سورة النبأ: ١–١٠',revision:'سورة الملك: ١–١٥',focus:'مراجعة مواضع الوقف والتكرار',latestScores:{hifz:8,recitation:7,tajweed:null},primaryTeacher:true,nextLessonId:'demo-lesson-1'},
  {id:'demo-learner-2',name:'طالبة تجريبية ب',level:'بداية الحفظ',lastSession:'قبل يومين',nextWird:'سورة الأعلى: ١–١٠',revision:'سورة الفاتحة',focus:'تصحيح أحكام المد',latestScores:{hifz:null,recitation:8,tajweed:7},primaryTeacher:true,nextLessonId:'demo-lesson-2'},
  {id:'demo-learner-3',name:'طالب تجريبي ج',level:'مراجعة الجزء التاسع والعشرين',lastSession:'الأسبوع الماضي',nextWird:'سورة الإنسان: ١–١٢',revision:'سورة القيامة',focus:'تعزيز المراجعة الأسبوعية',latestScores:{hifz:7,recitation:8,tajweed:8},primaryTeacher:true,nextLessonId:'demo-lesson-3'},
  {id:'demo-substitute',name:'طالب بديل تجريبي',level:'مراجعة مؤقتة',lastSession:'غير متاح للبديل',nextWird:'سورة البلد: ١–٥',revision:'الورد المصرح للحصة فقط',focus:'الملاحظات الضرورية لهذه الحصة فقط',latestScores:{hifz:null,recitation:null,tajweed:null},primaryTeacher:false,nextLessonId:'demo-lesson-4'},
];
export const DEMO_LESSONS: readonly TeacherLesson[] = [
  {id:'demo-lesson-1',learnerId:'demo-learner-1',day:'اليوم',date:'2026-10-29',startsAt:'04:00 م',reservedUntil:'04:40 م',kind:'standard',status:'waiting',isSubstitute:false,guardianAccepted:false,teacherPresent:true,learnerPresent:true,elapsedLateMinutes:0},
  {id:'demo-lesson-2',learnerId:'demo-learner-2',day:'اليوم',date:'2026-10-29',startsAt:'04:40 م',reservedUntil:'05:20 م',kind:'trial',status:'scheduled',isSubstitute:false,guardianAccepted:false,teacherPresent:false,learnerPresent:false,elapsedLateMinutes:0},
  {id:'demo-lesson-3',learnerId:'demo-learner-3',day:'غدًا',date:'2026-10-30',startsAt:'05:00 م',reservedUntil:'05:40 م',kind:'standard',status:'scheduled',isSubstitute:false,guardianAccepted:false,teacherPresent:false,learnerPresent:false,elapsedLateMinutes:0},
  {id:'demo-lesson-4',learnerId:'demo-substitute',day:'غدًا',date:'2026-10-30',startsAt:'05:40 م',reservedUntil:'06:20 م',kind:'makeup',status:'scheduled',isSubstitute:true,guardianAccepted:true,teacherPresent:false,learnerPresent:false,elapsedLateMinutes:0},
  {id:'demo-lesson-5',learnerId:'demo-learner-1',day:'الأمس',date:'2026-10-28',startsAt:'04:00 م',reservedUntil:'04:40 م',kind:'standard',status:'completed',isSubstitute:false,guardianAccepted:false,teacherPresent:false,learnerPresent:false,elapsedLateMinutes:0,reportId:'demo-report-1'},
];
export const DEMO_REPORTS: readonly LessonReport[] = [
  {id:'demo-report-1',lessonId:'demo-lesson-5',learnerId:'demo-learner-1',status:'draft',scope:'سورة النبأ ١–١٠',strengths:'إتقان جيد لبداية السورة.',corrections:'تحتاج الآية السادسة إلى تكرار ومراجعة الوقف.',nextPlan:'مراجعة ١–١٠ ثم تسميع ١١–٢٠.',hifz:8,recitation:7,tajweed:null,revision:1,publishedRevision:null},
  {id:'demo-report-2',lessonId:'demo-lesson-3',learnerId:'demo-learner-3',status:'published',scope:'سورة القيامة',strengths:'مراجعة مستقرة في معظم المواضع.',corrections:'تحسين التفخيم والترقيق.',nextPlan:'الانتقال لسورة الإنسان.',hifz:7,recitation:8,tajweed:8,revision:2,publishedRevision:2},
];
export const DEMO_ASSIGNMENTS: readonly TeacherAssignment[] = [
  {id:'demo-task-1',learnerId:'demo-learner-1',kind:'memorization',surah:78,surahName:'النبأ',fromAyah:11,toAyah:20,dueDate:'2026-10-30',status:'assigned',attempt:0,feedback:''},
  {id:'demo-task-2',learnerId:'demo-learner-2',kind:'recitation',surah:87,surahName:'الأعلى',fromAyah:1,toAyah:10,dueDate:'2026-10-29',status:'awaiting-review',attempt:1,feedback:''},
  {id:'demo-task-3',learnerId:'demo-learner-3',kind:'revision',surah:75,surahName:'القيامة',fromAyah:1,toAyah:12,dueDate:'2026-10-31',status:'retry-requested',attempt:2,feedback:'إعادة تسميع الآيات ٤–٨ مع ضبط المد.'},
];
export const DEMO_NOTICES: readonly TeacherNotice[] = [
  {id:'demo-notice-1',text:'تسميع ينتظر المراجعة',detail:'الطالبة التجريبية ب — محاولة صوتية تجريبية',section:'assignments',read:false},
  {id:'demo-notice-2',text:'تقرير لم يُعتمد بعد',detail:'حصة طالب تجريبي أ — لا يظهر للطالب',section:'reports',read:false},
  {id:'demo-notice-3',text:'حصة بديلة مؤكدة',detail:'وافَق ولي الأمر في المثال على الشيخ البديل لهذه الحصة فقط',section:'schedule',read:true},
];
export const DEMO_CASES: readonly TeacherIncident[] = [
  {id:'demo-case-1',lessonId:'demo-lesson-5',label:'انقطاع اتصال أثناء التسميع',detail:'يُحتفظ بالعلامات والدرجات ويُراجع السبب إداريًا دون خصم تلقائي.',status:'pending',kind:'connection'},
];

export function demoScenario(scenario: Scenario): {
  lessons: TeacherLesson[]; learners: TeacherLearner[]; incidents: TeacherIncident[];
} {
  if(scenario==='empty') return {lessons:[],learners:[],incidents:[]};
  const lessons=DEMO_LESSONS.map(l=>({...l}));
  const incidents=DEMO_CASES.map(c=>({...c}));
  const first=lessons[0]!;
  if(scenario==='student-late') {
    lessons[0]={...first,learnerPresent:false,teacherPresent:true,elapsedLateMinutes:18,status:'waiting'};
    incidents.push({id:'demo-late-student',lessonId:first.id,label:'انتظار الطالب أكثر من ١٥ دقيقة',detail:'يحق للشيخ تسجيل بلاغ مؤقت، ومع وصول الطالب يمكن بدء الحصة دون موافقة مسبقة.',status:'pending',kind:'student-absence'});
  }
  if(scenario==='teacher-late') {
    lessons[0]={...first,teacherPresent:false,learnerPresent:true,elapsedLateMinutes:12,status:'waiting'};
    incidents.push({id:'demo-late-teacher',lessonId:first.id,label:'تأخر الشيخ ١٢ دقيقة',detail:'تُنبه الإدارة بعد ٥ دقائق وتصعّد بعد ١٠. الطالب له حق مغادرة الانتظار وطلب التعويض دون غياب.',status:'pending',kind:'teacher-delay'});
  }
  if(scenario==='disconnect') {
    lessons[0]={...first,status:'live',teacherPresent:true,learnerPresent:false,elapsedLateMinutes:17};
    incidents.push({id:'demo-connection',lessonId:first.id,label:'الطالب فقد الاتصال',detail:'الحصة لا تنتهي تلقائيًا؛ يُسمح بإعادة الدخول واستعادة العمليات المؤكدة.',status:'pending',kind:'connection'});
  }
  if(scenario==='overtime') {
    lessons[0]={...first,status:'live',teacherPresent:true,learnerPresent:true,elapsedLateMinutes:44};
    incidents.push({id:'demo-overlap',lessonId:first.id,label:'تعارض مع الحصة التالية',detail:'لا ينهي السيستم الفصل تلقائيًا، ولا ينقل موعد الطالب التالي؛ الحالة للإدارة.',status:'pending',kind:'conflict'});
  }
  if(scenario==='substitute') {
    lessons[0]={...lessons[3]!,day:'اليوم',status:'waiting',teacherPresent:true,learnerPresent:true};
  }
  return {lessons,learners:DEMO_LEARNERS.map(l=>({...l})),incidents};
}
