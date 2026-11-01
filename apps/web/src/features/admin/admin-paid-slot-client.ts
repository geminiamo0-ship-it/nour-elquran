/** #317: Staff-only paid-slot inbox; data is never trusted from the browser. */
export type AdminPaidSlot = Readonly<{
 requestId:string;learnerId:string;learnerName:string;
 teacherId:string;teacherName:string;startsAtMs:number;endsAtMs:number;
 state:'pending'|'expired'|'approved'|'rejected';lessonId:string|null;
}>;
export class AdminPaidSlotError extends Error {
 constructor(readonly code:string,readonly status=0){super(code);}
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object=(v:unknown):v is Record<string,unknown>=>
 v!==null&&typeof v==='object'&&!Array.isArray(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&UUID.test(v);
const name=(v:unknown):v is string=>typeof v==='string'&&
 v.trim().length>0&&v.length<=200;
const clock=(v:unknown):v is number=>typeof v==='number'&&
 Number.isSafeInteger(v)&&v>=0;
const fields=['requestId','learnerId','learnerName','teacherId','teacherName',
 'startsAtMs','endsAtMs','state','lessonId'] as const;
function validRow(v:unknown):v is AdminPaidSlot {
 if(!object(v)||Object.keys(v).length!==fields.length||
  !fields.every(k=>Object.hasOwn(v,k))||
  !uuid(v.requestId)||!uuid(v.learnerId)||!uuid(v.teacherId)||
  !name(v.learnerName)||!name(v.teacherName)||
  !clock(v.startsAtMs)||!clock(v.endsAtMs)||
  v.endsAtMs!==v.startsAtMs+2400000||
  !['pending','expired','approved','rejected'].includes(String(v.state)))return false;
 return v.state==='approved'?uuid(v.lessonId):v.lessonId===null;
}
export function parseAdminPaidSlots(raw:unknown):readonly AdminPaidSlot[] {
 if(!object(raw)||raw.code!=='ACADEMY_PAID_SLOT_STAFF'||
  Object.keys(raw).some(k=>!['code','requests','requestId'].includes(k))||
  (raw.requestId!==undefined&&(typeof raw.requestId!=='string'||
   raw.requestId.length>128))||
  !Array.isArray(raw.requests)||raw.requests.length>100)
  throw new AdminPaidSlotError('INVALID_PAID_SLOT_STAFF_RESPONSE');
 const seen=new Set<string>();
 const result:AdminPaidSlot[]=[];
 for(const row of raw.requests){
  if(!validRow(row)||seen.has(row.requestId))
   throw new AdminPaidSlotError('INVALID_PAID_SLOT_STAFF_RESPONSE');
  seen.add(row.requestId);result.push(row);
 }
 return result;
}
export async function fetchAdminPaidSlots(signal?:AbortSignal):
 Promise<readonly AdminPaidSlot[]> {
 let response:Response;
 try{
  response=await fetch('/v1/staff/academy/paid-slot-requests',{
   method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',
   ...(signal?{signal}:{})
  });
 }catch{throw new AdminPaidSlotError('NETWORK_UNAVAILABLE');}
 let raw:unknown;
 try{raw=await response.json();}
 catch{throw new AdminPaidSlotError('INVALID_PAID_SLOT_STAFF_RESPONSE',response.status);}
 if(!response.ok){
  const code=object(raw)&&typeof raw.code==='string'&&
   /^[A-Z_]{1,64}$/.test(raw.code)?raw.code:'PAID_SLOT_STAFF_UNAVAILABLE';
  throw new AdminPaidSlotError(code,response.status);
 }
 return parseAdminPaidSlots(raw);
}
