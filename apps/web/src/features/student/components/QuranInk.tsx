'use client';

import { useRef, useState, type PointerEvent } from 'react';
import type { QuranInkStroke } from '../quranAnnotations';
import { pointToPath } from '../quranAnnotations';
import css from './QuranInk.module.css';

export type InkMode = 'off' | 'pen' | 'marker' | 'eraser';
type Props = {
  page: number;
  mode: InkMode;
  color: string;
  strokes: readonly QuranInkStroke[];
  onChange: (strokes: QuranInkStroke[]) => void;
};
export function QuranInk({ page, mode, color, strokes, onChange }: Props) {
  const active = useRef<{ pointerId:number; points:{x:number;y:number}[] } | null>(null);
  const [draft, setDraft] = useState<readonly {x:number;y:number}[]>([]);
  const enabled = mode !== 'off';

  function pos(e:PointerEvent<SVGSVGElement>) {
    const box=e.currentTarget.getBoundingClientRect();
    return { x:Math.max(0,Math.min(1000,(e.clientX-box.left)*1000/box.width)),
      y:Math.max(0,Math.min(1594,(e.clientY-box.top)*1594/box.height)) };
  }
  function begin(e:PointerEvent<SVGSVGElement>) {
    // Finger always scrolls on mobile; the S Pen or desktop mouse draws.
    if (!enabled || e.pointerType === 'touch' || (e.pointerType==='mouse' && e.button!==0)) return;
    const p=pos(e);
    if (mode==='eraser') {
      const found=[...strokes].reverse().find(s=>s.points.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<22));
      if (found) onChange(strokes.filter(s=>s.id!==found.id));
      return;
    }
    active.current={pointerId:e.pointerId,points:[p]};
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraft([p]);
    e.preventDefault();
  }
  function move(e:PointerEvent<SVGSVGElement>) {
    const a=active.current;
    if (!a || a.pointerId!==e.pointerId) return;
    const next=pos(e),last=a.points[a.points.length-1];
    if (last && Math.hypot(last.x-next.x,last.y-next.y)<2) return;
    if (a.points.length>2500) return;
    a.points.push(next);setDraft([...a.points]);
    e.preventDefault();
  }
  function end(e:PointerEvent<SVGSVGElement>) {
    const a=active.current;
    if (!a || a.pointerId!==e.pointerId) return;
    active.current=null;setDraft([]);
    if (a.points.length>1) onChange([...strokes,{
      id:'ink-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),
      page,color,width:mode==='marker'?16:3,kind:mode==='marker'?'marker':'pen',points:a.points
    }]);
  }
  return <svg className={enabled?css.active:css.passive} viewBox="0 0 1000 1594"
      preserveAspectRatio="none" aria-label="طبقة الرسم على المصحف"
      onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
    {strokes.map(s=><path key={s.id} d={pointToPath(s.points)}
      stroke={s.color} strokeWidth={s.width} opacity={s.kind==='marker'?0.36:0.9}
      fill="none" strokeLinecap="round" strokeLinejoin="round"/> )}
    {draft.length>1 && <path d={pointToPath(draft)} stroke={color}
      strokeWidth={mode==='marker'?16:3} opacity={mode==='marker'?0.36:0.9}
      fill="none" strokeLinecap="round" strokeLinejoin="round"/>}
  </svg>;
}
