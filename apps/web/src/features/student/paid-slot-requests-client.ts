/** #317: strictly parsed owner-only read model; never a booking or payment claim. */
export type PaidSlotState='pending'|'approved'|'rejected';
export type PaidSlotRequest=Readonly<{
 requestId:string;teacherId:string;startsAtMs:number;endsAtMs:number;
 state:PaidSlotState;lessonId:string|null;
}>;
export class PaidSlotRequestsError extends Error{
 constructor(readonly code:string,readonly status=0){super(code);}
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record=(v:unknown):v is Record<string,unknown>=>
 v!==null&&typeof v==='object'&&!Array.isArray(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&UUID.test(v);
const ms=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
const fields=['requestId','teacherId','startsAtMs','endsAtMs','state','lessonId'] as const;
function validRow(v:unknown):v is PaidSlotRequest{
 if(!record(v)||Object.keys(v).length!==fields.length||
  !fields.every(k=>Object.hasOwn(v,k))||!uuid(v.requestId)||!uuid(v.teacherId)||
  !ms(v.startsAtMs)||!ms(v.endsAtMs)||v.endsAtMs!==v.startsAtMs+2400000||
  !['pending','approved','rejected'].includes(String(v.state)))return false;
 return v.state==='approved'?uuid(v.lessonId):v.lessonId===null;
}
export function parsePaidSlotRequests(raw:unknown):readonly PaidSlotRequest[]{
 if(!record(raw)||raw.code!=='ACADEMY_PAID_SLOT_REQUESTS'||
  Object.keys(raw).some(k=>!['code','requests','requestId'].includes(k))||
  (raw.requestId!==undefined&&(typeof raw.requestId!=='string'||
   raw.requestId.length>128))||!Array.isArray(raw.requests)||
  raw.requests.length>30)throw new PaidSlotRequestsError('INVALID_PAID_SLOT_RESPONSE');
 const seen=new Set<string>();
 const rows:PaidSlotRequest[]=[];
 for(const item of raw.requests){
  if(!validRow(item)||seen.has(item.requestId))
   throw new PaidSlotRequestsError('INVALID_PAID_SLOT_RESPONSE');
  seen.add(item.requestId);rows.push(item);
 }
 return rows;
}
export async function fetchPaidSlotRequests(learnerId:string,signal?:AbortSignal):
 Promise<readonly PaidSlotRequest[]>{
 if(!uuid(learnerId))throw new PaidSlotRequestsError('INVALID_LEARNER',400);
 let response:Response;
 try{
  response=await fetch('/v1/me/learners/'+encodeURIComponent(learnerId)+
   '/paid-slot-requests',{method:'GET',credentials:'same-origin',cache:'no-store',
    redirect:'error',...(signal?{signal}:{})});
 }catch{throw new PaidSlotRequestsError('NETWORK_UNAVAILABLE');}
 let raw:unknown;
 try{raw=await response.json();}
 catch{throw new PaidSlotRequestsError('INVALID_PAID_SLOT_RESPONSE',response.status);}
 if(!response.ok){
  const code=record(raw)&&typeof raw.code==='string'&&
   /^[A-Z_]{1,64}$/.test(raw.code)?raw.code:'PAID_SLOT_UNAVAILABLE';
  throw new PaidSlotRequestsError(code,response.status);
 }
 return parsePaidSlotRequests(raw);
}
