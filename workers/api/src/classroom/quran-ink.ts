/** CR-04: per-lesson page-local ink ledger, immutable ink operations and bounded CAS. */
export type InkPoint=Readonly<{x:number;y:number}>;
export type InkStroke=Readonly<{
 id:string;page:number;color:string;width:number;kind:'pen'|'marker';points:readonly InkPoint[];
}>;
export type InkRecord=Readonly<{
 stroke:InkStroke;author:'teacher'|'learner';subject:string;visible:boolean;revision:number;
}>;
export type InkPage=Readonly<{
 page:number;revision:number;records:readonly InkRecord[];
 receipts:readonly {requestId:string;subject:string;signature:string}[];
}>;
export type VerifiedInkCommand=Readonly<{
 lessonId:string;learnerId:string;actorSubject:string;role:'teacher'|'learner';
 action:'snapshot'|'add'|'hide';page:number;
 expectedRevision?:number;requestId?:string;stroke?:InkStroke;strokeId?:string;
}>;
const id=/^[a-zA-Z0-9-]{1,128}$/,rid=/^[A-Za-z0-9-]{8,128}$/;
const inkId=/^[A-Za-z0-9_-]{8,100}$/;
export const MAX_PAGE_MARKS=200,MAX_MARK_POINTS=600;
function validStroke(x:unknown,page:number):x is InkStroke{
 if(!x||typeof x!=='object'||Array.isArray(x))return false;
 const s=x as Record<string,unknown>;
 if(Object.keys(s).length!==6||!['id','page','color','width','kind','points'].every(k=>Object.hasOwn(s,k))||
  typeof s.id!=='string'||!inkId.test(s.id)||s.page!==page||
  typeof s.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(s.color)||
  (s.kind!=='pen'&&s.kind!=='marker')||
  s.width!==(s.kind==='pen'?3:16)||!Array.isArray(s.points)||
  s.points.length<2||s.points.length>MAX_MARK_POINTS)return false;
 return s.points.every((p:unknown)=>{
  if(!p||typeof p!=='object'||Array.isArray(p))return false;
  const q=p as Record<string,unknown>;
  return Object.keys(q).length===2&&
   Number.isFinite(q.x)&&Number(q.x)>=0&&Number(q.x)<=1000&&
   Number.isFinite(q.y)&&Number(q.y)>=0&&Number(q.y)<=1594;
 });
}
export function parseInkCommand(value:unknown):VerifiedInkCommand|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const r=value as Record<string,unknown>,keys=Object.keys(r);
 const common=['lessonId','learnerId','actorSubject','role','action','page'];
 if(!common.every(x=>Object.hasOwn(r,x))||
  ![6,9].includes(keys.length)||typeof r.lessonId!=='string'||!id.test(r.lessonId)||
  typeof r.learnerId!=='string'||!id.test(r.learnerId)||
  typeof r.actorSubject!=='string'||!id.test(r.actorSubject)||
  (r.role!=='teacher'&&r.role!=='learner')||
  !Number.isInteger(r.page)||Number(r.page)<1||Number(r.page)>604)return null;
 if(r.action==='snapshot')return keys.length===6?r as VerifiedInkCommand:null;
 if(!['add','hide'].includes(String(r.action))||keys.length!==9||
  !Number.isSafeInteger(r.expectedRevision)||Number(r.expectedRevision)<0||
  typeof r.requestId!=='string'||!rid.test(r.requestId))return null;
 if(r.action==='add'&&
  Object.hasOwn(r,'stroke')&&!Object.hasOwn(r,'strokeId')&&
  validStroke(r.stroke,r.page as number))return r as VerifiedInkCommand;
 if(r.action==='hide'&&!Object.hasOwn(r,'stroke')&&
  typeof r.strokeId==='string'&&inkId.test(r.strokeId))return r as VerifiedInkCommand;
 return null;
}
export function initialInk(page:number):InkPage{return {page,revision:0,records:[],receipts:[]};}
export function visibleInk(s:InkPage){
 return {page:s.page,revision:s.revision,strokes:s.records.filter(x=>x.visible).map(x=>x.stroke)};
}
export function applyInk(s:InkPage,c:VerifiedInkCommand):
 {code:'INK_APPLIED'|'INK_REPLAY'|'INK_CONFLICT'|'INK_LIMIT';next:InkPage}{
 const signature=c.action==='add'?JSON.stringify(c.stroke):String(c.strokeId);
 const receipt=s.receipts.find(x=>x.subject===c.actorSubject&&x.requestId===c.requestId);
 if(receipt)return {code:receipt.signature===c.action+':'+signature?'INK_REPLAY':'INK_CONFLICT',next:s};
 if(c.expectedRevision!==s.revision||s.revision>=Number.MAX_SAFE_INTEGER)
  return {code:'INK_CONFLICT',next:s};
 if(c.action==='add'&&(s.records.length>=MAX_PAGE_MARKS||
  s.records.some(x=>x.stroke.id===c.stroke!.id)))
  return {code:s.records.length>=MAX_PAGE_MARKS?'INK_LIMIT':'INK_CONFLICT',next:s};
 const target=c.action==='hide'?s.records.find(x=>x.stroke.id===c.strokeId):null;
 // The learner can erase only their own ink. The verified Sheikh can moderate
 // any shared lesson ink without changing its original author attribution.
 if(c.action==='hide'&&(!target||!target.visible||
    (c.role==='learner'&&target.subject!==c.actorSubject)))
  return {code:'INK_CONFLICT',next:s};
 const revision=s.revision+1;
 const records=c.action==='add'?
  [...s.records,{stroke:c.stroke!,author:c.role,subject:c.actorSubject,visible:true,revision}]:
  s.records.map(x=>x.stroke.id===c.strokeId?{...x,visible:false,revision}:x);
 return {code:'INK_APPLIED',next:{page:s.page,revision,records,
  receipts:[...s.receipts.slice(-31),{requestId:c.requestId!,subject:c.actorSubject,
   signature:c.action+':'+signature}]}};
}
