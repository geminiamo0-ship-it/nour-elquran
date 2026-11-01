import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {PremiumHome} from './PremiumHome';
import {studentNavigation} from './StudentShell';
import {StudentProvider} from './StudentContext';
import {LessonHub} from './components/LessonHub';

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
 it('only offers the live entry link for a real live lesson',()=>{
  const target='/classroom/live?role=learner&lessonId=synthetic&learnerId=student';
  const html=renderToStaticMarkup(<PremiumHome name="طالب" tasks={[]} grades={[]}
   lesson={{time:'وقت الحصة',href:target,action:'دخول الحصة',live:true}}/>);
  expect(html).toContain(target.replaceAll('&','&amp;'));
  expect(html).toContain('دخول الحصة');
 });
 it('keeps report and private notebook workflows in the unified lessons view',()=>{
  const report=renderToStaticMarkup(<StudentProvider><LessonHub initialTab="reports"/></StudentProvider>);
  const notebook=renderToStaticMarkup(<StudentProvider><LessonHub initialTab="notebook"/></StudentProvider>);
  expect(report).toContain('التقارير والتقدم');
  expect(report).toContain('لا توجد تقارير منشورة');
  expect(notebook).toContain('دفتر الحصص');
  expect(notebook).toContain('لا توجد حصص مكتملة');
 });
});
