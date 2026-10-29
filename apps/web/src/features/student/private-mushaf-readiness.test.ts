import {describe,expect,it} from 'vitest';
import {mayEditPrivateMushafPage,type PrivateMushafReadiness} from './private-mushaf-readiness';

const ready:PrivateMushafReadiness={
 enabled:true,learnerId:'learner-a',activePage:42,
 indexLearnerId:'learner-a',pageHydration:{learnerId:'learner-a',page:42},failed:false,
};
describe('connected private Quran write readiness (#149)',()=>{
 it('allows the authenticated current page only after both reads complete',()=>{
  expect(mayEditPrivateMushafPage(ready,42)).toBe(true);
  expect(mayEditPrivateMushafPage({...ready,indexLearnerId:null},42)).toBe(false);
  expect(mayEditPrivateMushafPage({...ready,pageHydration:null},42)).toBe(false);
 });
 it('blocks an adjacent leaf and stale page while navigation is loading',()=>{
  expect(mayEditPrivateMushafPage(ready,43)).toBe(false);
  expect(mayEditPrivateMushafPage({...ready,activePage:43},43)).toBe(false);
 });
 it('rejects stale hydration from a different learner, even on the same page',()=>{
  expect(mayEditPrivateMushafPage({...ready,learnerId:'learner-b'},42)).toBe(false);
  expect(mayEditPrivateMushafPage({...ready,pageHydration:{learnerId:'learner-b',page:42}},42)).toBe(false);
 });
 it('locks connected edits after a failed save until retry',()=>{
  expect(mayEditPrivateMushafPage({...ready,failed:true},42)).toBe(false);
 });
 it('preserves the local-only demo spread and drawing',()=>{
  expect(mayEditPrivateMushafPage({...ready,enabled:false,failed:true},43)).toBe(true);
 });
});
