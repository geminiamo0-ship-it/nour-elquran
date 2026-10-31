import {describe,expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QuranConcealmentOverlay} from './components/QuranConcealmentOverlay';
import type {QuranAyahRegion} from './quranSource';

const regions:QuranAyahRegion[]=[
 {surah:67,ayah:1,polygon:'M 10 12 L 40 12 L 40 30 Z'},
 {surah:67,ayah:2,polygon:'M 10 31 L 40 31 L 40 50 Z'},
 {surah:67,ayah:3,polygon:'invalid-source-polygon'}
];
const html=(page:number,keys:ReadonlySet<string>,source=regions)=>
 renderToStaticMarkup(createElement(QuranConcealmentOverlay,{
  page,regions:source,revealedKeys:keys
 }));

describe('real printed Quran memorization privacy',()=>{
 it('covers entire original artwork when all verses are concealed',()=>{
  const view=html(562,new Set());
  expect(view).toContain('viewBox="0 0 345 550"');
  expect(view).toContain('fill="#fbf6e8"');
  expect(view).toContain('<mask');
  expect(view).toContain('maskUnits="userSpaceOnUse"');
  expect(view).not.toContain('<path');
  expect(view).toContain('النص القرآني مخفي');
 });
 it('opens verified exact publisher polygon for only the chosen revealed verse',()=>{
  const view=html(562,new Set(['67:1','67:3']));
  expect(view).toContain('M 10 12 L 40 12 L 40 30 Z');
  expect(view).not.toContain('M 10 31 L 40 31 L 40 50 Z');
  expect(view).not.toContain('invalid-source-polygon');
  expect((view.match(/<path/g)??[])).toHaveLength(1);
 });
 it('never leaks page art via missing/untrusted metadata while hide mode is on',()=>{
  const view=html(562,new Set(['67:1']),[]);
  expect(view).toContain('fill="#fbf6e8"');
  expect(view).not.toContain('<path');
 });
 it('uses the publisher opening spread viewBox, not guessed 345x550 coordinates',()=>{
  const view=html(1,new Set(['67:1']));
  expect(view).toContain('viewBox="-53.3109 -198.4777 345 550"');
  expect(view).toContain('x="-53.3109"');
  expect(view).toContain('y="-198.4777"');
 });
});
