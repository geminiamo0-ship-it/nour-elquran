import type {QuranInkStroke} from './quranAnnotations';

export type CumulativeQuranMark=Readonly<{
 itemId:string;page:number;kind:'pen'|'marker'|'highlight'|'note';
 originType:'lesson'|'assignment'|'self_study';originId:string|null;
 audience:'shared'|'private';authorRole:'teacher'|'learner';visible:boolean;
 surah:number|null;ayah:number|null;payload:Record<string,unknown>;
}>;
export type CumulativePage=Readonly<{marks:readonly CumulativeQuranMark[];
 legacyInk:readonly QuranInkStroke[]}>;
export class CumulativeReadError extends Error{
 constructor(public code:string,public status:number){super(code);}
}
const isObject=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function parseStroke(raw:Record<string,unknown>,id:string,page:number,kind:'pen'|'marker'):
 QuranInkStroke|null{
 const points=raw.points;
 if(!Array.isArray(points)||points.length<2||points.length>2500||
  typeof raw.color!=='string'||!/^#[a-f0-9]{6}$/i.test(raw.color)||
  typeof raw.width!=='number'||raw.width<1||raw.width>60)return null;
 if(!points.every(p=>isObject(p)&&typeof p.x==='number'&&typeof p.y==='number'&&
    Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1000&&
    p.y>=0&&p.y<=1594))return null;
 return {id,page,kind,color:raw.color,width:raw.width,
  points:points.map(p=>({x:p.x as number,y:p.y as number}))};
}
export function canonicalInk(mark:CumulativeQuranMark):QuranInkStroke|null{
 if(!mark.visible||(mark.kind!=='pen'&&mark.kind!=='marker'))return null;
 return parseStroke(mark.payload,mark.itemId,mark.page,mark.kind);
}
const ids=/^[A-Za-z0-9_.:-]{8,128}$/;
function parseMark(raw:unknown,page:number):CumulativeQuranMark|null{
 if(!isObject(raw)||typeof raw.itemId!=='string'||!ids.test(raw.itemId)||
  raw.page!==page||typeof raw.visible!=='boolean'||
  !['pen','marker','highlight','note'].includes(String(raw.kind))||
  !['shared','private'].includes(String(raw.audience))||
  !['teacher','learner'].includes(String(raw.authorRole))||
  !['self_study','lesson','assignment'].includes(String(raw.originType))||
  !(raw.originId===null||(typeof raw.originId==='string'&&ids.test(raw.originId)))||
  !(raw.surah===null||(Number.isInteger(raw.surah)&&Number(raw.surah)>=1&&Number(raw.surah)<=114))||
  !(raw.ayah===null||(Number.isInteger(raw.ayah)&&Number(raw.ayah)>=1))||
  !isObject(raw.payload))return null;
 return raw as CumulativeQuranMark;
}
export function parseCumulativePage(raw:unknown,learnerId:string,page:number):CumulativePage{
 if(!isObject(raw)||raw.code!=='QURAN_COMPOSITE_READ'||
  raw.learnerId!==learnerId||!Array.isArray(raw.current)||
  !Array.isArray(raw.legacyPrivate)||raw.current.length>300||
  raw.legacyPrivate.length>300)throw new CumulativeReadError('INVALID_CUMULATIVE_RESPONSE',0);
 const marks=raw.current.map(m=>parseMark(m,page));
 if(marks.some(m=>m===null))throw new CumulativeReadError('INVALID_CUMULATIVE_MARK',0);
 const legacyInk:QuranInkStroke[]=[];
 for(const rawItem of raw.legacyPrivate){
  if(!isObject(rawItem)||rawItem.page!==page||rawItem.visible!==true||
   typeof rawItem.itemId!=='string'||!ids.test(rawItem.itemId)||
   !['pen','marker'].includes(String(rawItem.kind))||!isObject(rawItem.payload))continue;
  const stroke=parseStroke(rawItem.payload,rawItem.itemId,page,rawItem.kind as 'pen'|'marker');
  if(stroke)legacyInk.push(stroke);
 }
 return {marks:marks as CumulativeQuranMark[],legacyInk};
}
export async function fetchCumulativePage(learnerId:string,page:number,signal?:AbortSignal){
 if(!/^[A-Za-z0-9-]{1,128}$/.test(learnerId)||!Number.isInteger(page)||page<1||page>604)
  throw new CumulativeReadError('INVALID_CUMULATIVE_SCOPE',0);
 let response:Response;
 try{
  response=await fetch('/v1/me/learners/'+encodeURIComponent(learnerId)+
   '/cumulative-quran?page='+page,{
   method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal,
  });
 }catch{throw new CumulativeReadError('CUMULATIVE_NETWORK_ERROR',0);}
 let data:unknown;
 try{data=await response.json();}catch{throw new CumulativeReadError('INVALID_CUMULATIVE_RESPONSE',response.status);}
 if(!response.ok)throw new CumulativeReadError(isObject(data)&&typeof data.code==='string'?
  data.code:'CUMULATIVE_READ_UNAVAILABLE',response.status);
 return parseCumulativePage(data,learnerId,page);
}
