/** Signed learner-scoped academy catalog and requests. Never a payment receipt. */
export type AcademyOffer=Readonly<{versionId:string;packageId:string;title:string;priceEgp:number;sessions:number}>;
export type AcademyRequest=Readonly<{id:string;title:string;priceEgp:number;sessions:number;atMs:number;state:'pending'|'activated'|'rejected'}>;
export type OwnerAcademy=Readonly<{packages:readonly AcademyOffer[];requests:readonly AcademyRequest[];whatsappNumber:string|null}>;
const isObject=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const uid=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9-]{1,128}$/.test(v);
const title=(v:unknown)=>typeof v==='string'&&v.length>=2&&v.length<=80;
const price=(v:unknown)=>int(v)&&Number(v)>=1&&Number(v)<=100000;
const sessions=(v:unknown)=>int(v)&&Number(v)>=1&&Number(v)<=60;
export function parseOwnerAcademy(raw:unknown):OwnerAcademy{
 if(!isObject(raw)||raw.code!=='ACADEMY_OWNER'||!Array.isArray(raw.packages)||
  !Array.isArray(raw.requests)||raw.packages.length>100||raw.requests.length>30||
  !(raw.whatsappNumber===null||(typeof raw.whatsappNumber==='string'&&
   /^[1-9][0-9]{9,14}$/.test(raw.whatsappNumber))))throw Error('ACADEMY_INVALID_RESPONSE');
 const packages:AcademyOffer[]=raw.packages.map((p:unknown)=>{
  if(!isObject(p)||!uid(p.versionId)||!uid(p.packageId)||!title(p.title)||
   !price(p.priceEgp)||!sessions(p.sessions))throw Error('ACADEMY_INVALID_RESPONSE');
  return {versionId:p.versionId as string,packageId:p.packageId as string,
   title:p.title as string,priceEgp:p.priceEgp as number,sessions:p.sessions as number};
 });
 const requests:AcademyRequest[]=raw.requests.map((r:unknown)=>{
  if(!isObject(r)||!uid(r.id)||!title(r.title)||!price(r.priceEgp)||
   !sessions(r.sessions)||!int(r.atMs)||
   !['pending','activated','rejected'].includes(String(r.state)))throw Error('ACADEMY_INVALID_RESPONSE');
  return {id:r.id as string,title:r.title as string,priceEgp:r.priceEgp as number,
   sessions:r.sessions as number,atMs:r.atMs as number,
   state:r.state as AcademyRequest['state']};
 });
 return {packages,requests,whatsappNumber:raw.whatsappNumber as string|null};
}
export async function readOwnerAcademy(learnerId:string,signal?:AbortSignal):Promise<OwnerAcademy>{
 if(!uid(learnerId))throw Error('INVALID_LEARNER');
 let response:Response;
 try{
  response=await fetch('/v1/me/learners/'+encodeURIComponent(learnerId)+'/academy',{
   credentials:'same-origin',cache:'no-store',redirect:'error',...(signal?{signal}:{})});
 }catch{throw Error('ACADEMY_UNAVAILABLE');}
 let raw:unknown;
 try{raw=await response.json();}catch{throw Error('ACADEMY_UNAVAILABLE');}
 if(!response.ok)throw Error('ACADEMY_UNAVAILABLE');
 return parseOwnerAcademy(raw);
}
export function latestPendingAcademyRequest(data:OwnerAcademy){
 return data.requests.filter(r=>r.state==='pending').sort((a,b)=>b.atMs-a.atMs)[0]??null;
}
export function currentCycleLabel(state:'within_period'|'expired',endsAtMs:number,now:number){
 return state==='within_period'&&endsAtMs>now?'دورة حصص مسجلة':'الدورة السابقة انتهت';
}
