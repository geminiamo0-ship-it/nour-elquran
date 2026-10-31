'use client';

import { useRef, useState, type PointerEvent } from 'react';
import type { QuranInkStroke } from '../quranAnnotations';
import type { PreviewFrame } from '@/features/classroom/ink-preview';
import { pointToPath } from '../quranAnnotations';
import css from './QuranInk.module.css';

export type InkMode = 'off' | 'pen' | 'marker' | 'eraser';
type Props = {
  page: number;
  mode: InkMode;
  color: string;
  strokes: readonly QuranInkStroke[];
  /** Teacher/classroom academic overlay: never editable by personal eraser. */
  fixedStrokes?: readonly QuranInkStroke[];
  onChange: (strokes: QuranInkStroke[]) => void;
  /** Live room provisional updates, never a permanent ink save. */
  onPreview?: (frame:PreviewFrame) => void;
  previewStrokes?: readonly QuranInkStroke[];
};
type Draft= {pointerId:number;strokeId:string;points:{x:number;y:number}[];
 lastSent:number;sentPoints:number;seq:number;kind:'pen'|'marker';color:string;width:3|16};
export function QuranInk({ page, mode, color, strokes, fixedStrokes = [],
 onChange,onPreview,previewStrokes=[] }: Props) {
  const active = useRef<Draft|null>(null);
  function publish(a:Draft,phase:'start'|'move'|'end'|'cancel',force=false){
    if(!onPreview)return;
    const now=performance.now();
    if(phase==='move'&&!force&&now-a.lastSent<32)return;
    const pending=phase==='end'||phase==='cancel'?[]:a.points.slice(a.sentPoints);
    if((phase==='start'||phase==='move')&&!pending.length)return;
    // The realtime packet is deliberately bounded; canonical onChange gets
    // all points even when a high-frequency S Pen produces many samples.
    const points=pending.length<=64?pending:Array.from({length:64},(_,i)=>
      pending[Math.round(i*(pending.length-1)/63)]!);
    onPreview({type:'ink-preview',phase,strokeId:a.strokeId,page,
      seq:++a.seq,kind:a.kind,color:a.color,width:a.width,points});
    a.lastSent=now;a.sentPoints=a.points.length;
  }
  const [draft, setDraft] = useState<readonly {x:number;y:number}[]>([]);
  const enabled = mode !== 'off';

  function pos(e:PointerEvent<SVGSVGElement>) {
    const box=e.currentTarget.getBoundingClientRect();
    return { x:Math.max(0,Math.min(1000,(e.clientX-box.left)*1000/box.width)),
      y:Math.max(0,Math.min(1594,(e.clientY-box.top)*1594/box.height)) };
  }
  function begin(e:PointerEvent<SVGSVGElement>) {
    // In drawing mode, a finger or S Pen must draw; browsing/swiping works when mode=off.
    if (!enabled || !e.isPrimary || (e.pointerType==='mouse' && e.button!==0)) return;
    const p=pos(e);
    if (mode==='eraser') {
      const found=[...strokes].reverse().find(s=>s.points.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<22));
      if (found) onChange(strokes.filter(s=>s.id!==found.id));
      e.preventDefault();
      return;
    }
    const kind=mode==='marker'?'marker':'pen';
    const next:Draft={pointerId:e.pointerId,
      strokeId:'ink-'+crypto.randomUUID(),points:[p],lastSent:0,
      sentPoints:0,seq:-1,kind,color,width:kind==='marker'?16:3};
    active.current=next;
    publish(next,'start',true);
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
    a.points.push(next);setDraft([...a.points]);publish(a,'move');
    e.preventDefault();
  }
  function end(e:PointerEvent<SVGSVGElement>) {
    const a=active.current;
    if (!a || a.pointerId!==e.pointerId) return;
    publish(a,'move',true);publish(a,a.points.length>1?'end':'cancel',true);
    active.current=null;setDraft([]);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (a.points.length>1) onChange([...strokes,{
      id:a.strokeId,
      page,color:a.color,width:a.width,kind:a.kind,points:a.points
    }]);
  }
  function cancel(e:PointerEvent<SVGSVGElement>) {
    if(active.current?.pointerId===e.pointerId){
      publish(active.current,'cancel',true);active.current=null;setDraft([]);
    }
  }
  return <svg className={enabled?css.active:css.passive} viewBox="0 0 1000 1594"
      preserveAspectRatio="none" aria-label="طبقة الرسم على المصحف"
      data-ink-mode={mode} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel}>
    {enabled && <rect width="1000" height="1594" fill="transparent" pointerEvents="all" aria-hidden="true" /> }
    {strokes.map(s=><path key={s.id} d={pointToPath(s.points)}
      stroke={s.color} strokeWidth={s.width} opacity={s.kind==='marker'?0.36:0.9}
      fill="none" strokeLinecap="round" strokeLinejoin="round"/> )}
    {fixedStrokes.map(s=><path key={'academic-'+s.id} d={pointToPath(s.points)}
      stroke={s.color} strokeWidth={s.width} opacity={s.kind==='marker'?0.36:0.9}
      fill="none" strokeLinecap="round" strokeLinejoin="round"
      pointerEvents="none" aria-label="علامة تعليمية مشتركة"/>)}
    {previewStrokes.map(s=><path key={'preview-'+s.id} d={pointToPath(s.points)}
      stroke={s.color} strokeWidth={s.width} opacity={s.kind==='marker'?0.30:0.70}
      fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"
      aria-label="رسم لحظي غير محفوظ بعد"/>)}
    {draft.length>1 && <path d={pointToPath(draft)} stroke={color}
      strokeWidth={mode==='marker'?16:3} opacity={mode==='marker'?0.36:0.9}
      fill="none" strokeLinecap="round" strokeLinejoin="round"/>}
  </svg>;
}
