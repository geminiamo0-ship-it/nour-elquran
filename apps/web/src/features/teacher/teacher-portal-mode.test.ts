import {describe,it,expect} from 'vitest';
import {resolveTeacherPortalMode} from './teacher-portal-mode';
describe('zero-mock Sheikh portal',()=>{
 it('requires signed account and explicit backend enablement',()=>{
  expect(resolveTeacherPortalMode(true,'authenticated')).toBe('connected');
  expect(resolveTeacherPortalMode(true,'signed-out')).toBe('signed-out');
  expect(resolveTeacherPortalMode(true,'checking')).toBe('checking');
 });
 it('never displays demo for denied, failed, disabled or undefined states',()=>{
  for(const status of ['error','disabled','role-denied','signed-out','authenticated']){
   expect(resolveTeacherPortalMode(false,status)).toBe('error');
  }
  expect(resolveTeacherPortalMode(true,'error')).toBe('error');
  expect(resolveTeacherPortalMode(true,'role-denied')).toBe('error');
 });
});
