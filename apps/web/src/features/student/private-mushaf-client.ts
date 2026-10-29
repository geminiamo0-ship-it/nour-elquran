import type {QuranAnnotation,QuranInkStroke,QuranTarget} from './quranAnnotations';
import {QURAN_EDITION,QURAN_VERSION} from './quranSource';

export const PRIVATE_MUSHAF_EDITION=`${QURAN_EDITION}:${QURAN_VERSION}`;
export type PrivateItemKind='pen'|'marker'|'note'|'highlight'|'bookmark'|'position';
export type PrivateAction='put'|'hide'|'restore';
export type PrivateItem=Readonly<{
 itemId:string;kind:PrivateItemKind;page:number;version:number;visible:boolean;
 payload:Record<string,unknown>;
}>;
export type PrivateOperation=Readonly<{
 operationId:string;action:PrivateAction;itemId:string;kind:PrivateItemKind;
 page:number;expectedVersion:number;payload:Record<string,unknown>;
}>;
export class MushafSaveError extends Error {
 constructor(public code:string,public status:number){super(code);}
}
function object(raw:unknown):Record<string,unknown>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new MushafSaveError('INVALID_RESPONSE',0);
 return raw as Record<string,unknown>;
}
function parseItem(raw:unknown):PrivateItem{
 const item=object(raw);
 if(typeof item.itemId!=='string'||!/^[A-Za-z0-9_:.-]{1,128}$/.test(item.itemId)||
  !['pen','marker','note','highlight','bookmark','position'].includes(String(item.kind))||
  !Number.isInteger(item.page)||Number(item.page)<1||Number(item.page)>604||
  !Number.isInteger(item.version)||Number(item.version)<1||
  typeof item.visible!=='boolean')throw new MushafSaveError('INVALID_RESPONSE',0);
 return {itemId:item.itemId,kind:item.kind as PrivateItemKind,
  page:item.page as number,version:item.version as number,visible:item.visible,payload:object(item.payload)};
}
function path(learnerId:string):string{
 if(!/^[A-Za-z0-9-]{1,128}$/.test(learnerId))throw new MushafSaveError('INVALID_LEARNER_ID',0);
 return '/v1/me/learners/'+learnerId+'/mushaf';
}
async function request(learnerId:string,query:string,body?:PrivateOperation,signal?:AbortSignal):Promise<Record<string,unknown>>{
 let response:Response;
 try{
  response=await fetch(path(learnerId)+query,{
   method:body?'POST':'GET',credentials:'same-origin',redirect:'error',cache:'no-store',
   ...(signal?{signal}:{}),...(body?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{}),
  });
 }catch{throw new MushafSaveError('NETWORK_ERROR',0);}
 let data:Record<string,unknown>;
 try{data=object(await response.json());}catch{throw new MushafSaveError('INVALID_RESPONSE',response.status);}
 if(!response.ok)throw new MushafSaveError(typeof data.code==='string'?data.code:'SAVE_FAILED',response.status);
 if(data.learnerId!==learnerId)throw new MushafSaveError('LEARNER_MISMATCH',0);
 return data;
}
export const privateMushafClient={
 async page(learnerId:string,page:number,signal?:AbortSignal):Promise<PrivateItem[]>{
  if(!Number.isInteger(page)||page<1||page>604)throw new MushafSaveError('INVALID_PAGE',0);
  const data=await request(learnerId,'?page='+page,undefined,signal);
  if(!Array.isArray(data.items)||data.items.length>300)throw new MushafSaveError('INVALID_RESPONSE',0);
  return data.items.map(parseItem);
 },
 async index(learnerId:string,signal?:AbortSignal):Promise<PrivateItem[]>{
  const data=await request(learnerId,'?index=1',undefined,signal);
  if(!Array.isArray(data.items)||data.items.length>300)throw new MushafSaveError('INVALID_RESPONSE',0);
  return data.items.map(parseItem);
 },
 async mutate(learnerId:string,operation:PrivateOperation):Promise<PrivateItem>{
  const data=await request(learnerId,'',operation);
  return parseItem(data.item);
 },
};
export function asInk(item:PrivateItem):QuranInkStroke|null {
 if(!item.visible||(item.kind!=='pen'&&item.kind!=='marker'))return null;
 const points=item.payload.points;
 if(!Array.isArray(points)||points.length<2||points.length>2500)return null;
 const safe=points.every(p=>p&&typeof p==='object'&&typeof p.x==='number'&&
  typeof p.y==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.y));
 if(!safe||typeof item.payload.color!=='string'||typeof item.payload.width!=='number')return null;
 return {id:item.itemId,page:item.page,kind:item.kind,
  color:item.payload.color,width:item.payload.width,points:points as {x:number;y:number}[]};
}
export function asPrivateNote(item:PrivateItem,learnerId:string):QuranAnnotation|null{
 if(!item.visible||item.kind!=='note'||typeof item.payload.text!=='string'||
  !item.payload.target||typeof item.payload.target!=='object')return null;
 const target={...(item.payload.target as object),page:item.page} as QuranTarget;
 if(typeof target.surah!=='number'||typeof target.ayah!=='number')return null;
 return {id:item.itemId,learnerId,type:'private',published:false,authorLabel:'ملاحظتي الشخصية',
  target,text:item.payload.text,color:String(item.payload.color??'#f6cd46'),createdAt:'1970-01-01T00:00:00Z'};
}
