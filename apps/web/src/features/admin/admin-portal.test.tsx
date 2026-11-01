import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminOverviewPanel,AdminPendingSection} from './AdminSections';
import {ADMIN_NAVIGATION,getAdminRoute,type AdminRoute} from './admin-navigation';
import {AdminShell,ADMIN_PORTAL_ENABLED} from './AdminShell';
describe('Admin Phase A readonly layout (#302)',()=>{
 it('shows actual source counts only in the gated overview component',()=>{
  const html=renderToStaticMarkup(<AdminOverviewPanel value={{asOfMs:1793600000000,
   metrics:{activeLearners:13,activeQualifiedTeachers:2,
    upcomingLessons:4,completedLessons:6}}} onRefresh={()=>{}}/>);
  expect(html).toContain('نظرة عامة على الأكاديمية');
  expect(html).toContain((13).toLocaleString('ar-EG'));
  expect(html).toContain('قراءة فقط');
  expect(html).not.toContain('طالب تجريبي');
  expect(html).not.toContain('مبلغ مدفوع');
 });
 it('makes every pending section honest and non-actionable',()=>{
  for(const route of ADMIN_NAVIGATION.filter(n=>!n.connected)){
   const html=renderToStaticMarkup(<AdminPendingSection
    route={route.href as Exclude<AdminRoute,'/admin'>}/>);
   expect(html).toContain('غير مفعل تشغيليًا');
   expect(html).not.toContain('<input');
   expect(html).not.toContain('تم اعتماد');
  }
 });
 it('normalizes static-export paths',()=>{
  expect(getAdminRoute('/admin/')).toBe('/admin');
  expect(getAdminRoute('/admin/teachers/')).toBe('/admin/teachers');
  expect(getAdminRoute('/admin/unknown/')).toBe('/admin');
 });
 it('never displays protected sections in default-off builds',()=>{
  if(!ADMIN_PORTAL_ENABLED){
   const html=renderToStaticMarkup(<AdminShell/>);
   expect(html).toContain('لوحة الإدارة غير مفعّلة');
   expect(html).not.toContain('ملفات الطلاب النشطة');
  }
 });
});
