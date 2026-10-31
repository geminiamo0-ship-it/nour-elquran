'use client';

import {useId} from 'react';
import type {QuranAyahRegion} from '../quranSource';
import {pageViewBox,regionPath} from './QuranAyahOverlay';
import css from './QuranConcealmentOverlay.module.css';

/** Mask the *printed Quran artwork*, not only a separate verse list.
 * The screen is fully opaque until valid publisher polygons are available;
 * revealing a verse opens a hole only for that verified region.
 * This layer deliberately sits ABOVE existing study highlights, ink and taps.
 */
export function QuranConcealmentOverlay({page,regions,revealedKeys}:{
 page:number;regions:readonly QuranAyahRegion[];revealedKeys:ReadonlySet<string>;
}){
 const maskId=useId();
 const box=pageViewBox(page),[x,y,w,h]=box.split(' ').map(Number);
 const holes=regions.flatMap(region=>{
  if(!revealedKeys.has(region.surah+':'+region.ayah))return [];
  const path=regionPath(region.polygon);
  return path?[{key:region.surah+':'+region.ayah,path}]:[];
 });
 return <svg className={css.shield} viewBox={box} preserveAspectRatio="xMidYMid meet"
  role="img" aria-label="اختبار حفظ: النص القرآني مخفي في المصحف إلا الآيات المكشوفة">
  <defs><mask id={maskId} maskUnits="userSpaceOnUse"
   x={x} y={y} width={w} height={h}>
   <rect x={x} y={y} width={w} height={h} fill="white"/>
   {holes.map(hole=><path key={hole.key} d={hole.path} fill="black"/>)}
  </mask></defs>
  <rect x={x} y={y} width={w} height={h}
   fill="#fbf6e8" mask={`url(#${maskId})`}/>
 </svg>;
}
