import type {QuranInkStroke} from '@/features/student';
export type InkView=Readonly<{page:number;revision:number;strokes:readonly QuranInkStroke[]}>;
export type InkResult=Readonly<{code:string;ink:InkView;persistence?:'pending'|'saved';
 /** Server grants writes only for signed, live lessons with D1 durable mode enabled. */
 canWrite?:boolean}>;
export type ConnectedIdentity=Readonly<{role:'teacher'|'learner';lessonId:string;learnerId?:string}>;
export type InkChange=
 |Readonly<{action:'add';page:number;expectedRevision:number;requestId:string;stroke:QuranInkStroke}>
 |Readonly<{action:'hide';page:number;expectedRevision:number;requestId:string;strokeId:string}>;
const pathFor=(id:ConnectedIdentity)=>{
 const base=id.role==='teacher'?'/v1/teacher/lessons/'+encodeURIComponent(id.lessonId):
  '/v1/me/learners/'+encodeURIComponent(id.learnerId!)+
  '/lessons/'+encodeURIComponent(id.lessonId);
 return base+'/quran-ink';
};
function validInk(raw:unknown):raw is InkView{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 const s=raw as Record<string,unknown>;
 if(Object.keys(s).length!==3||!Number.isInteger(s.page)||Number(s.page)<1||Number(s.page)>604||
  !Number.isSafeInteger(s.revision)||Number(s.revision)<0||
  !Array.isArray(s.strokes)||s.strokes.length>200)return false;
 return s.strokes.every((x:unknown)=>{
  if(!x||typeof x!=='object'||Array.isArray(x))return false;
  const stroke=x as Record<string,unknown>;
  if(Object.keys(stroke).length!==6||typeof stroke.id!=='string'||
   !/^[A-Za-z0-9_-]{8,100}$/.test(stroke.id)||
   stroke.page!==s.page||typeof stroke.color!=='string'||
   !/^#[0-9A-Fa-f]{6}$/.test(stroke.color)||
   (stroke.kind!=='pen'&&stroke.kind!=='marker')||
   stroke.width!==(stroke.kind==='pen'?3:16)||
   !Array.isArray(stroke.points)||stroke.points.length<2||stroke.points.length>600)return false;
  return stroke.points.every((p:unknown)=>{
   if(!p||typeof p!=='object'||Array.isArray(p))return false;
   const v=p as Record<string,unknown>;
   return Object.keys(v).length===2&&Number.isFinite(v.x)&&Number(v.x)>=0&&Number(v.x)<=1000&&
    Number.isFinite(v.y)&&Number(v.y)>=0&&Number(v.y)<=1594;
  });
 });
}
export async function fetchLiveInk(id:ConnectedIdentity,page:number,change?:InkChange):
 Promise<InkResult>{
 const url=pathFor(id)+(change?'':'?page='+encodeURIComponent(page));
 const response=await fetch(url,{method:change?'POST':'GET',
  ...(change?{headers:{'content-type':'application/json'},body:JSON.stringify(change)}:{}),
  credentials:'same-origin',cache:'no-store',redirect:'error'});
 let raw:unknown;
 try{raw=await response.json();}catch{throw Error('INVALID_INK_RESPONSE');}
 const body=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:null;
 if(body&&validInk(body.ink)&&(response.ok||response.status===409||response.status===413)&&
  ['INK_SNAPSHOT','INK_APPLIED','INK_REPLAY','INK_CONFLICT','INK_LIMIT',
   'INK_PENDING_PERSISTENCE'].includes(String(body.code)))
  return {code:String(body.code),ink:body.ink,
   ...(body.persistence==='pending'||body.persistence==='saved'?{persistence:body.persistence}:{}),
   ...(typeof body.canWrite==='boolean'?{canWrite:body.canWrite}:{})};
 // Reject a malformed successful snapshot instead of surfacing its success code.
 if(!response.ok&&typeof body?.code==='string')throw Error(body.code);
 throw Error('CLASSROOM_INK_UNAVAILABLE');
}
/** One drawn stroke can be 2500 pointer points; the server enforces <=600. */
export function compactStroke(stroke:QuranInkStroke):QuranInkStroke{
 if(stroke.points.length<=600)return stroke;
 const last=stroke.points.length-1;
 return {...stroke,points:Array.from({length:600},(_,i)=>
  stroke.points[Math.round(i*last/599)]!)};
}
