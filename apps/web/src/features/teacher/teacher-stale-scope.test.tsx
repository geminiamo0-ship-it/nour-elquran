import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {TeacherConnectedAssignments} from './TeacherConnectedAssignments';
import {TeacherConnectedPreparation} from './TeacherConnectedPreparation';
import {TeacherConnectedReports} from './TeacherConnectedReports';
import type {TeacherCalendarRow,TeacherRosterRow} from './teacher-read-api';

const learners:readonly TeacherRosterRow[]=[
 {id:'student-a',name:'الطالب الأول',learnerType:'child'},
 {id:'student-b',name:'الطالب الثاني',learnerType:'child'}];
const lessons:readonly TeacherCalendarRow[]=[
 {id:'lesson-one',learnerId:'student-a',kind:'standard',status:'completed',
  startsAtMs:1800000000000,endsAtMs:1800002400000},
 {id:'lesson-two',learnerId:'student-b',kind:'trial',status:'scheduled',
  startsAtMs:1800100000000,endsAtMs:1800102400000}];
it('Sheikh assignment view never paints another learner data before signed read',()=>{
 const html=renderToStaticMarkup(<TeacherConnectedAssignments learners={learners}/>);
 expect(html).toContain('جارٍ تحميل');
 expect(html).not.toContain('مسودات الشيخ الخاصة');
 expect(html).not.toContain('تكليف منشور');
});
it('Sheikh reports are not editable or painted before signed lesson report is loaded',()=>{
 const html=renderToStaticMarkup(<TeacherConnectedReports learners={learners} lessons={lessons}/>);
 expect(html).toContain('جارٍ تحميل حالة التقرير وصلاحيات الحصة');
 expect(html).not.toContain('اعتماد ونشر التقرير');
});
it('Sheikh prep shows pending assignments until exact scoped student read',()=>{
 const html=renderToStaticMarkup(<TeacherConnectedPreparation learners={learners} lessons={lessons}/>);
 expect(html).toContain('جارٍ تحميل واجبات');
 expect(html).not.toContain('لم ينشر الشيخ واجبًا لهذا الطالب بعد');
});
