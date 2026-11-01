/** #307: staff-only fixed-contract read models; all values originate in D1.
 * No account identifiers, role headers, arbitrary search, writes or fake data.
 */
export const ADMIN_DATA_VIEWS=['students','schedule','subscriptions','attendance'] as const;
export type AdminDataView=typeof ADMIN_DATA_VIEWS[number];
export type AdminDataRow=Readonly<Record<string,string|number>>;
export type AdminCollection=Readonly<{
 view:AdminDataView;asOfMs:number;rows:readonly AdminDataRow[];truncated:boolean;
}>;
export class AdminCollectionError extends Error{
 constructor(readonly code:string,readonly status=0){super(code);}
}
const record=(v:unknown):v is Record<string,unknown>=>
 v!==null&&typeof v==='object'&&!Array.isArray(v);
const id=/^[A-Za-z0-9_-]{1,128}$/;
const whole=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
const label=(v:unknown,max=120):v is string=>
 typeof v==='string'&&v.length>0&&v.length<=max&&v.trim()===v;
const FIELDS:Record<AdminDataView,readonly string[]>={
 students:['id','name','learnerType','status','lessonCount'],
 schedule:['id','startsAtMs','kind','status','learnerName','teacherName'],
 subscriptions:['id','learnerName','startsAtMs','endsAtMs','baseSessions','rolloverSessions','spentSessions'],
 attendance:['id','kind','submittedAtMs','decision'],
};
function validRow(view:AdminDataView,raw:unknown):raw is Record<string,string|number>{
 if(!record(raw)||Object.keys(raw).length!==FIELDS[view].length||
  !FIELDS[view].every(k=>Object.hasOwn(raw,k))||
  typeof raw.id!=='string'||!id.test(raw.id))return false;
 switch(view){
  case 'students':
   return label(raw.name,80)&&['adult','child'].includes(String(raw.learnerType))&&
    ['active','archived'].includes(String(raw.status))&&whole(raw.lessonCount);
  case 'schedule':
   return whole(raw.startsAtMs)&&label(raw.learnerName,80)&&label(raw.teacherName)&&
    ['trial','standard','makeup'].includes(String(raw.kind))&&
    ['scheduled','live','completed','cancelled'].includes(String(raw.status));
  case 'subscriptions':
   return label(raw.learnerName,80)&&whole(raw.startsAtMs)&&whole(raw.endsAtMs)&&
    raw.endsAtMs>raw.startsAtMs&&whole(raw.baseSessions)&&
    raw.baseSessions>=1&&raw.baseSessions<=60&&whole(raw.rolloverSessions)&&
    raw.rolloverSessions<=60&&whole(raw.spentSessions)&&
    raw.spentSessions<=raw.baseSessions+raw.rolloverSessions;
  case 'attendance':
   return whole(raw.submittedAtMs)&&
    ['student_no_show','connection_interruption'].includes(String(raw.kind))&&
    ['pending','accepted','rejected'].includes(String(raw.decision));
 }
}
export function parseAdminCollection(view:AdminDataView,raw:unknown):AdminCollection{
 if(!record(raw)||raw.code!=='STAFF_COLLECTION'||raw.readOnly!==true||
  raw.view!==view||!whole(raw.asOfMs)||typeof raw.truncated!=='boolean'||
  !Array.isArray(raw.rows)||raw.rows.length>50||
  Object.keys(raw).some(k=>!['code','readOnly','view','asOfMs','rows','truncated',
   'requestId'].includes(k))||
  raw.requestId!==undefined&&(typeof raw.requestId!=='string'||
   raw.requestId.length>128))
  throw new AdminCollectionError('INVALID_COLLECTION');
 const rows:AdminDataRow[]=[];
 const ids=new Set<string>();
 for(const value of raw.rows){
  if(!validRow(view,value)||ids.has(value.id))
   throw new AdminCollectionError('INVALID_COLLECTION');
  ids.add(value.id);
  rows.push(value);
 }
 if(raw.truncated&&rows.length!==50)
  throw new AdminCollectionError('INVALID_COLLECTION');
 return {view,asOfMs:raw.asOfMs,rows,truncated:raw.truncated};
}
export async function fetchAdminCollection(view:AdminDataView,signal?:AbortSignal):
 Promise<AdminCollection>{
 let response:Response;
 try{
  response=await fetch('/v1/staff/collections?view='+view,{
   method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',
   ...(signal?{signal}:{})});
 }catch{throw new AdminCollectionError('NETWORK_UNAVAILABLE');}
 let body:unknown;
 try{body=await response.json();}catch{
  throw new AdminCollectionError('INVALID_COLLECTION',response.status);
 }
 if(!response.ok){
  const code=record(body)&&typeof body.code==='string'?body.code:
   'STAFF_COLLECTION_UNAVAILABLE';
  throw new AdminCollectionError(code,response.status);
 }
 return parseAdminCollection(view,body);
}
