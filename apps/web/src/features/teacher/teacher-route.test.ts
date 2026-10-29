import {describe,it,expect} from 'vitest';
import {teacherRoute} from './teacher-route';
describe('connected teacher static export routes',()=>{
 it('normalizes both slash variants of authenticated Sheikh pages',()=>{
  for(const pathname of ['/teacher','/teacher/students','/teacher/schedule',
    '/teacher/assignments','/teacher/reports']){
    expect(teacherRoute(pathname+'/')).toBe(pathname);
    expect(teacherRoute(pathname)).toBe(pathname);
  }
 });
 it('preserves non-teacher URLs and rejects accidental route alias',()=>{
  expect(teacherRoute('/student/account/')).toBe('/student/account/');
  expect(teacherRoute('/teacher-evil/students/')).toBe('/teacher-evil/students/');
 });
});
