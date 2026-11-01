import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {PremiumHome} from './PremiumHome';
import {studentNavigation} from './StudentShell';
import {StudentDashboard} from './StudentDashboard';
import {DEMO_PROFILES} from './mock-adapter';
import {StudentProvider} from './StudentContext';
import {LessonHub} from './components/LessonHub';
import {TrainingWorkspace} from './components/TrainingWorkspace';

describe('approved premium learner experience #322',()=>{
 it('exposes exactly four primary destinations in the agreed order',()=>{
  expect(studentNavigation.map(x=>x.label)).toEqual([
   'الرئيسية','حصصي','تدريباتي','المصحف'
  ]);
  expect(new Set(studentNavigation.map(x=>x.href)).size).toBe(4);
 });
 it('shows new learners a useful next action without fabricated progress or zero metrics',()=>{
  const html=renderToStaticMarkup(<PremiumHome name="طالب جديد" tasks={[]} grades={[]}/>);
  expect(html).toContain('عرض المواعيد والحجز');
  expect(html).toContain('ابدأ تدريبي الآن');
  expect(html).not.toContain('46%');
  expect(html).not.toContain('0 / 10');
 });
 it('links from the home to a specific authenticated published assignment',()=>{
  const id='11111111-2222-4333-8444-555555555555';
  const html=renderToStaticMarkup(<PremiumHome name="طالب" grades={[]}
    tasks={[{id,label:'الملك 1–5',kind:'حفظ'}]}/>);
  expect(html).toContain('#assignment-'+id);
  expect(html).toContain('ابدأ واجبي الآن');
 });
 it('shows the same premium sample UI on a route that needs no account',()=>{
  const sample=renderToStaticMarkup(<StudentProvider liveLearners={DEMO_PROFILES}
   initialSelectedId="demo-active"><StudentDashboard previewBasePath="/preview/student"/></StudentProvider>);
  expect(sample).toContain('/preview/student/lessons');
  expect(sample).toContain('/preview/student/training');
  expect(sample).toContain('/preview/student/mushaf');
  expect(sample).toContain('الحفظ');
  expect(sample).not.toContain('خدمة الحسابات غير متاحة');
  expect(sample).not.toContain('href="/student/');
 });
 it('only offers the live entry link for a real live lesson',()=>{
  const target='/classroom/live?role=learner&lessonId=synthetic&learnerId=student';
  const html=renderToStaticMarkup(<PremiumHome name="طالب" tasks={[]} grades={[]}
   lesson={{time:'وقت الحصة',href:target,action:'دخول الحصة',live:true}}/>);
  expect(html).toContain(target.replaceAll('&','&amp;'));
  expect(html).toContain('دخول الحصة');
 });
 it('rebuilds lessons around one upcoming session without redundant weekly panels or mock booking',()=>{
  const markup=renderToStaticMarkup(<StudentProvider liveLearners={DEMO_PROFILES}
   initialSelectedId="demo-active"><LessonHub/></StudentProvider>);
  expect(markup).toContain('حصصي');
  expect(markup).toContain('سجل الحصص');
  expect(markup).toContain('التقارير');
  expect(markup).toContain('مراجعة سورة الإخلاص');
  expect(markup).not.toContain('أيام حصصي الأسبوعية');
  expect(markup).not.toContain('التجربة المجانية والجدول المنتظم');
  expect(markup).not.toContain('اختر يومًا من الأسبوع');
 });
 it('shows demo assignments as compact actions without always-open notes and fake totals',()=>{
  const html=renderToStaticMarkup(<StudentProvider liveLearners={DEMO_PROFILES}
   initialSelectedId="demo-active"><TrainingWorkspace/></StudentProvider>);
  expect(html).toContain('مراجعة المحفوظ');
  expect(html).toContain('ابدأ في المصحف');
  expect(html).toContain('ملاحظتي');
  expect(html).not.toContain('كل تدريب له هدف واضح');
  expect(html).not.toContain('الواجبات في المعاينة');
  expect(html).not.toContain('ملاحظتي قبل الحصة');
  expect(html).not.toContain('إيه اللي هتعمله داخل التدريب؟');
 });
 it('selects useful self practice for new learners instead of empty homework',()=>{
  const html=renderToStaticMarkup(<StudentProvider liveLearners={DEMO_PROFILES}
   initialSelectedId="demo-new"><TrainingWorkspace/></StudentProvider>);
  expect(html).toContain('اختر سورة وابدأ');
  expect(html).toContain('سورة الإخلاص');
  expect(html).toContain('المصحف الكامل');
 });
 it('never guesses the signed learner assignment count while the server loads',()=>{
  const html=renderToStaticMarkup(<StudentProvider liveLearners={[{
    id:'synthetic-child',name:'طالب موثق',stage:'new',demo:false
  }]}><TrainingWorkspace/></StudentProvider>);
  expect(html).toContain('جارٍ تحميل واجباتك');
  expect(html).not.toContain('2 / 0');
  expect(html).not.toContain('سورة الإخلاص');
 });
 it('keeps report and private notebook workflows in the unified lessons view',()=>{
  const report=renderToStaticMarkup(<StudentProvider><LessonHub initialTab="reports"/></StudentProvider>);
  const notebook=renderToStaticMarkup(<StudentProvider><LessonHub initialTab="notebook"/></StudentProvider>);
  expect(report).toContain('تقارير الشيخ');
  expect(report).toContain('لا توجد تقارير منشورة');
  expect(notebook).toContain('سجل الحصص');
  expect(notebook).toContain('لا توجد حصص مكتملة');
 });
});
