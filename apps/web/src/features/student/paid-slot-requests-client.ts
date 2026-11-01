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


/** #317: proposal creation does not book a lesson or debit a subscription.
 * Callers must preserve the exact input (especially operationId) on an
 * uncertain network result and only offer server-sourced teacher/cycle/slot.
 */
export type PaidSlotProposalInput=Readonly<{
 operationId:string;teacherId:string;cycleId:string;startsAtMs:number;
}>;
export type PaidSlotProposalAck=Readonly<{
 code:'ACADEMY_PAID_SLOT_CREATED'|'ACADEMY_PAID_SLOT_REPLAY';
 slotRequestId:string;
}>;
export function parsePaidSlotProposalAck(raw:unknown,status:number):PaidSlotProposalAck{
 if(!record(raw)||Object.keys(raw).some(k=>
  !['code','slotRequestId','requestId'].includes(k))||
  (raw.requestId!==undefined&&(typeof raw.requestId!=='string'||
   raw.requestId.length>128))||!uuid(raw.slotRequestId)||
  !((status===201&&raw.code==='ACADEMY_PAID_SLOT_CREATED')||
    (status===200&&raw.code==='ACADEMY_PAID_SLOT_REPLAY')))
  throw new PaidSlotRequestsError('INVALID_PAID_SLOT_PROPOSAL_ACK',status);
 return {code:raw.code as PaidSlotProposalAck['code'],
  slotRequestId:raw.slotRequestId as string};
}
export async function submitPaidSlotProposal(learnerId:string,
 input:PaidSlotProposalInput):Promise<PaidSlotProposalAck>{
 if(!uuid(learnerId)||!uuid(input.operationId)||!uuid(input.teacherId)||
  !uuid(input.cycleId)||!ms(input.startsAtMs))
  throw new PaidSlotRequestsError('INVALID_PAID_SLOT_PROPOSAL_INPUT',400);
 let response:Response;
 try{
  response=await fetch('/v1/me/learners/'+encodeURIComponent(learnerId)+
   '/paid-slot-requests',{method:'POST',credentials:'same-origin',
    cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(input)});
 }catch{throw new PaidSlotRequestsError('NETWORK_OUTCOME_UNKNOWN');}
 let raw:unknown;
 try{raw=await response.json();}
 catch{throw new PaidSlotRequestsError('NETWORK_OUTCOME_UNKNOWN',response.status);}
 if(!response.ok){
  const code=record(raw)&&typeof raw.code==='string'&&
   /^[A-Z_]{1,64}$/.test(raw.code)?raw.code:'PAID_SLOT_PROPOSAL_UNAVAILABLE';
  throw new PaidSlotRequestsError(code,response.status);
 }
 return parsePaidSlotProposalAck(raw,response.status);
}
