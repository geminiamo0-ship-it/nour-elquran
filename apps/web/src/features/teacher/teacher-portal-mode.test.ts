import {describe,it,expect} from 'vitest';
import {resolveTeacherPortalMode} from './teacher-portal-mode';
describe('connected Sheikh role boundary',()=>{
 it('shows public demo only for signed-out visitors when feature is on',()=>{
  expect(resolveTeacherPortalMode(true,'signed-out')).toBe('preview');
  expect(resolveTeacherPortalMode(true,'checking')).toBe('checking');
 });
 it('never turns authenticated or failed identity into fixtures',()=>{
  expect(resolveTeacherPortalMode(true,'authenticated')).toBe('connected');
  expect(resolveTeacherPortalMode(true,'error')).toBe('error');
  expect(resolveTeacherPortalMode(true,'disabled')).toBe('error');
  expect(resolveTeacherPortalMode(true,'role-denied')).toBe('error');
 });
 it('preserves existing static demo when feature is disabled',()=>{
  for(const status of ['authenticated','signed-out','checking','error']){
   expect(resolveTeacherPortalMode(false,status)).toBe('preview');
  }
 });
});
