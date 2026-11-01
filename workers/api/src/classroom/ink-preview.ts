/** Ephemeral live pen preview. Never part of the canonical Quran ledger.
 * A signed WebSocket carries up to 64 sampled points per bounded frame.
 * The DO derives the source role from its verified attachment, not JSON. */
export type InkPreviewFrame=Readonly<{
 type:'ink-preview';phase:'start'|'move'|'end'|'cancel';strokeId:string;
 page:number;seq:number;kind:'pen'|'marker';color:string;width:3|16;
 points:ReadonlyArray<Readonly<{x:number;y:number}>>;
}>;
export type RemoteInkPreview=InkPreviewFrame&Readonly<{source:'teacher'|'learner'}>;
const inkId=/^[A-Za-z0-9_-]{8,100}$/;
export const MAX_PREVIEW_POINTS=64;
export const MAX_PREVIEW_BYTES=3800;
const phases=['start','move','end','cancel'];
export function parseInkPreview(raw:unknown):InkPreviewFrame|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const x=raw as Record<string,unknown>;
 if(Object.keys(x).length!==9||x.type!=='ink-preview'||
    !phases.includes(String(x.phase))||
    typeof x.strokeId!=='string'||!inkId.test(x.strokeId)||
    !Number.isInteger(x.page)||Number(x.page)<1||Number(x.page)>604||
    !Number.isSafeInteger(x.seq)||Number(x.seq)<0||Number(x.seq)>5000||
    (x.kind!=='pen'&&x.kind!=='marker')||
    typeof x.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(x.color)||
    x.width!==(x.kind==='pen'?3:16)||
    !Array.isArray(x.points)||x.points.length>MAX_PREVIEW_POINTS||
    ((x.phase==='start'||x.phase==='move')&&x.points.length<1)||
    ((x.phase==='end'||x.phase==='cancel')&&x.points.length!==0))
   return null;
 for(const point of x.points){
  if(!point||typeof point!=='object'||Array.isArray(point))return null;
  const p=point as Record<string,unknown>;
  if(Object.keys(p).length!==2||
     !Number.isFinite(p.x)||Number(p.x)<0||Number(p.x)>1000||
     !Number.isFinite(p.y)||Number(p.y)<0||Number(p.y)>1594)return null;
 }
 return x as InkPreviewFrame;
}
export function parseRemoteInkPreview(raw:unknown):RemoteInkPreview|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const x=raw as Record<string,unknown>,{source,...frame}=x;
 if(source!=='teacher'&&source!=='learner')return null;
 const parsed=parseInkPreview(frame);
 return parsed?{...parsed,source}:null;
}
