import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {TeacherConnectedHome,TeacherConnectedRoster,TeacherConnectedSchedule} from './TeacherConnectedPages';

const learner={id:'learner-1',name:'متعلم صناعي',learnerType:'child' as const};
const lesson={id:'lesson-1',learnerId:'learner-1',kind:'trial' as const,
  status:'scheduled' as const,startsAtMs:Date.now()+3600000,endsAtMs:Date.now()+6000000};
describe('connected teacher portal verified D1 projections',()=>{
  it('renders true zero-state without fixtures or phantom teacher actions',()=>{
    const home=renderToStaticMarkup(createElement(TeacherConnectedHome,{learners:[],lessons:[]}));
    const roster=renderToStaticMarkup(createElement(TeacherConnectedRoster,{learners:[]}));
    const schedule=renderToStaticMarkup(createElement(TeacherConnectedSchedule,{learners:[],lessons:[]}));
    expect(home).toContain('طلابي المسندون');
    expect(home).toContain('لا توجد حصة قادمة');
    expect(roster).toContain('لا يوجد طلاب مسندون');
    expect(schedule).toContain('لا توجد حصص');
    for(const html of [home,roster,schedule]){
      expect(html).not.toContain('حساب الشيخ التجريبي');
      expect(html).not.toContain('تم نشر');
      expect(html).not.toContain('بدأت الحصة');
      expect(html).not.toContain('DEMO');
    }
  });
  it('renders assigned learner and its real authorized lesson only',()=>{
    const home=renderToStaticMarkup(createElement(TeacherConnectedHome,{learners:[learner],lessons:[lesson]}));
    const roster=renderToStaticMarkup(createElement(TeacherConnectedRoster,{learners:[learner]}));
    const schedule=renderToStaticMarkup(createElement(TeacherConnectedSchedule,{learners:[learner],lessons:[lesson]}));
    expect(home).toContain('متعلم صناعي');
    expect(roster).toContain('متعلم صناعي');
    expect(schedule).toContain('متعلم صناعي');
    expect(roster).toContain('خطة الحفظ والمراجعة غير مربوطة');
    expect(schedule).toContain('40 دقيقة حجز');
    expect(schedule).toContain('توقيت القاهرة');
    expect(home).not.toContain('تسميعات تنتظر التصحيح');
    expect(home).not.toContain('تقارير تحتاج الاعتماد');
  });
});
