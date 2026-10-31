import type {QuranInkStroke} from '@/features/student';

/** Preview frames are ephemeral and NEVER count as saved academic marks. */
export type PreviewPhase='start'|'move'|'end'|'cancel';
export type PreviewFrame=Readonly<{
 type:'ink-preview';phase:PreviewPhase;strokeId:string;page:number;
 seq:number;kind:'pen'|'marker';color:string;width:3|16;
 points:ReadonlyArray<Readonly<{x:number;y:number}>>;
}>;
export type PeerPreview=PreviewFrame&Readonly<{source:'teacher'|'learner'}>;
const phases=['start','move','end','cancel'];
export function validPreview(value:unknown):value is PeerPreview{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const x=value as Record<string,unknown>;
 if(Object.keys(x).length!==10||
   x.type!=='ink-preview'||!phases.includes(String(x.phase))||
   (x.source!=='teacher'&&x.source!=='learner')||
   typeof x.strokeId!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(x.strokeId)||
   !Number.isInteger(x.page)||Number(x.page)<1||Number(x.page)>604||
   !Number.isSafeInteger(x.seq)||Number(x.seq)<0||Number(x.seq)>5000||
   (x.kind!=='pen'&&x.kind!=='marker')||
   typeof x.color!=='string'||!/^#[0-9A-Fa-f]{6}$/.test(x.color)||
   x.width!==(x.kind==='pen'?3:16)||
   !Array.isArray(x.points)||x.points.length>64||
   ((x.phase==='start'||x.phase==='move')&&x.points.length<1)||
   ((x.phase==='end'||x.phase==='cancel')&&x.points.length!==0))return false;
 return x.points.every((p:unknown)=>{
  if(!p||typeof p!=='object'||Array.isArray(p))return false;
  const pt=p as Record<string,unknown>;
  return Object.keys(pt).length===2&&
   Number.isFinite(pt.x)&&Number(pt.x)>=0&&Number(pt.x)<=1000&&
   Number.isFinite(pt.y)&&Number(pt.y)>=0&&Number(pt.y)<=1594;
 });
}
export type PreviewDrawing=Readonly<{
 stroke:QuranInkStroke;seq:number;seenAtMs:number;source:'teacher'|'learner';
}>;
/** Deterministic delta reconstruction, no reordering, no persistence promises.
 * Gaps discard an incomplete preview; the saved server snapshot takes over. */
export function reducePreview(previous:readonly PreviewDrawing[],
 frame:PeerPreview,now=Date.now()):PreviewDrawing[]{
 const current=previous.filter(x=>now-x.seenAtMs<2400);
 if(frame.phase==='cancel')return current.filter(x=>x.stroke.id!==frame.strokeId);
 const existing=current.find(x=>x.stroke.id===frame.strokeId);
 if(frame.phase==='end'){
  return existing?current.map(x=>x.stroke.id===frame.strokeId?{
   ...x,seenAtMs:now-1600
  }:x):current;
 }
 if(frame.phase==='start'){
  if(frame.seq!==0)return current;
  return [...current.filter(x=>x.stroke.id!==frame.strokeId),{
   source:frame.source,seq:frame.seq,seenAtMs:now,
   stroke:{id:frame.strokeId,page:frame.page,color:frame.color,
    width:frame.width,kind:frame.kind,points:[...frame.points]}
  }].slice(-6);
 }
 if(!existing||frame.seq!==existing.seq+1||
   existing.stroke.page!==frame.page||
   existing.stroke.kind!==frame.kind||
   existing.stroke.color!==frame.color||
   existing.source!==frame.source||
   existing.stroke.points.length+frame.points.length>2500)
  return current.filter(x=>x.stroke.id!==frame.strokeId);
 return current.map(x=>x===existing?{
  ...x,seq:frame.seq,seenAtMs:now,
  stroke:{...x.stroke,points:[...x.stroke.points,...frame.points]}
 }:x);
}
