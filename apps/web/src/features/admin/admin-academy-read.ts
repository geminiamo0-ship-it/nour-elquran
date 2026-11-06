/** #315: Strict, bounded signed Admin academy read contract.
 * Project only the documented DTO fields; D1/HTTP extras are never UI state.
 */
export type AcademyPackage={
 id:string;packageId:string;title:string;priceEgp:number;
 sessions:number;active:0|1;atMs:number;
};
export type AcademyRequest={
 id:string;learnerId:string;learnerName:string;title:string;
 priceEgp:number;sessions:number;packageVersionId:string;
 atMs:number;state:'pending'|'activated'|'rejected';
};
export type AcademyInvite={
 id:string;teacherName:string|null;claimed:0|1;teacherId:string|null;
 createdAtMs:number;expiresAtMs:number;claimedAtMs:number|null;
};
export type AdminAcademySnapshot={
 code:'ACADEMY_STAFF';packages:AcademyPackage[];
 requests:AcademyRequest[];invites:AcademyInvite[];
 whatsappNumber:string|null;
};
const record=(v:unknown):v is Record<string,unknown>=>
 v!==null&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown):v is string=>
 typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const label=(v:unknown,max=200):v is string=>
 typeof v==='string'&&v.trim().length>0&&v.length<=max;
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>
 Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const fail=():never=>{throw new Error('ACADEMY_STAFF_INVALID_RESPONSE');};
function list<T>(v:unknown,max:number,parse:(row:unknown)=>T,key:(row:T)=>string):T[]{
 if(!Array.isArray(v)||v.length>max)fail();
 const seen=new Set<string>();
 return v.map(item=>{
  const row=parse(item),k=key(row);
  if(seen.has(k))fail();
  seen.add(k);return row;
 });
}
function packageRow(v:unknown):AcademyPackage{
 if(!record(v)||!id(v.id)||!id(v.packageId)||!label(v.title,80)||
  !integer(v.priceEgp,1,100000)||!integer(v.sessions,1,60)||
  (v.active!==0&&v.active!==1)||!integer(v.atMs))fail();
 return {id:v.id,packageId:v.packageId,title:v.title,priceEgp:v.priceEgp,
  sessions:v.sessions,active:v.active,atMs:v.atMs};
}
function requestRow(v:unknown):AcademyRequest{
 if(!record(v)||!id(v.id)||!id(v.learnerId)||!label(v.learnerName)||
  !label(v.title,80)||!integer(v.priceEgp,1,100000)||
  !integer(v.sessions,1,60)||!id(v.packageVersionId)||
  !integer(v.atMs)||!['pending','activated','rejected'].includes(String(v.state)))
  fail();
 return {id:v.id,learnerId:v.learnerId,learnerName:v.learnerName,
  title:v.title,priceEgp:v.priceEgp,sessions:v.sessions,
  packageVersionId:v.packageVersionId,atMs:v.atMs,
  state:v.state as AcademyRequest['state']};
}
function inviteRow(v:unknown):AcademyInvite{
 if(!record(v)||!id(v.id)||
  !(v.teacherName===null||label(v.teacherName))||
  (v.claimed!==0&&v.claimed!==1)||
  !(v.teacherId===null||id(v.teacherId))||
  !integer(v.createdAtMs)||!integer(v.expiresAtMs)||
  !(v.claimedAtMs===null||integer(v.claimedAtMs)))fail();
 return {id:v.id,teacherName:v.teacherName,claimed:v.claimed,
  teacherId:v.teacherId,createdAtMs:v.createdAtMs,
  expiresAtMs:v.expiresAtMs,claimedAtMs:v.claimedAtMs};
}
/** Malformed signed receipts are errors, never empty/demo lists or trusted UI data. */
export function parseAdminAcademyRead(raw:unknown):AdminAcademySnapshot{
 if(!record(raw)||raw.code!=='ACADEMY_STAFF')fail();
 const packages=list(raw.packages,100,packageRow,row=>row.id);
 const requests=list(raw.requests,100,requestRow,row=>row.id);
 const invites=list(raw.invites,50,inviteRow,row=>row.id);
 if(!(raw.whatsappNumber===null||
  (typeof raw.whatsappNumber==='string'&&
   /^[1-9][0-9]{9,14}$/.test(raw.whatsappNumber))))fail();
 if(new Set(packages.map(p=>p.packageId)).size!==packages.length)fail();
 return {code:'ACADEMY_STAFF',packages,requests,invites,
  whatsappNumber:raw.whatsappNumber};
}
