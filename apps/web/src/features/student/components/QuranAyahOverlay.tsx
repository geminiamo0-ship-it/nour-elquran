'use client';

import type { KeyboardEvent } from 'react';
import type { QuranAyahRegion } from '../quranSource';
import type { QuranTarget } from '../quranAnnotations';
import css from './QuranAyahOverlay.module.css';

/** JSON polygons are in the artwork's own root user space (not CSS pixels). */
export function pageViewBox(page: number): string {
  return page <= 2 ? '-53.3109 -198.4777 345 550' : '0 0 345 550';
}
/** Pages 1-2 use a bare polygon point list; 3-604 use M/L/Z SVG paths. */
export function regionPath(polygon: string): string | null {
  if (typeof polygon !== 'string' || polygon.length < 8 || polygon.length > 20000) return null;
  if (/^\s*[Mm]/.test(polygon)) return /^[\d\s,.MLZmlz-]+$/.test(polygon) ? polygon : null;
  if (!/^[\d.,\s-]+$/.test(polygon)) return null;
  const points=polygon.trim().split(/\s+/).filter(Boolean);
  if (points.length<3 || points.length>500 || !points.every(x=>/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(x))) return null;
  return 'M'+points[0]+' '+points.slice(1).map(p=>'L'+p).join(' ')+' Z';
}
type Props={
  page:number;
  regions:readonly QuranAyahRegion[];
  selectedKey:string|null;
  noteKeys:ReadonlySet<string>;
  onSelect:(target:QuranTarget)=>void;
  onOpenNote:(target:QuranTarget)=>void;
  enabled:boolean;
};
/** In contrast to a PNG + guessed boxes, this is the publisher's exact verse footprint. */
export function QuranAyahOverlay({page,regions,selectedKey,noteKeys,onSelect,onOpenNote,enabled}:Props){
  return <svg className={enabled?css.overlay:css.disabled} viewBox={pageViewBox(page)}
    preserveAspectRatio="xMidYMid meet" aria-label="اضغط مرة لتحديد الآية ومرتين لفتح ملاحظتها">
    {enabled&&regions.map(region=>{
      const key=region.surah+':'+region.ayah;
      const d=regionPath(region.polygon);
      if(!d)return null;
      const selected=selectedKey===key,annotated=noteKeys.has(key);
      const target:QuranTarget={page,surah:region.surah,ayah:region.ayah,wordIndex:null};
      function enter(event:KeyboardEvent<SVGPathElement>){
        if(event.key==='Enter'||event.key===' '){event.preventDefault();onOpenNote(target);}
      }
      return <path key={key} d={d} className={selected?css.selected:annotated?css.annotated:css.hotspot}
        tabIndex={0} role="button" aria-label={'تحديد الآية '+key+' واضغط مرتين لفتح ملاحظتها'}
        onClick={()=>onSelect(target)} onKeyDown={enter}/>;
    })}
  </svg>;
}
