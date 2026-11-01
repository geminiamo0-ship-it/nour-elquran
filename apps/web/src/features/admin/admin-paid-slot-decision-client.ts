/** #317: A staff decision is an audited D1 write, never an optimistic debit. */
import {AdminPaidSlotError} from './admin-paid-slot-client';

export type PaidSlotDecision='approved'|'rejected';
export type PaidSlotDecisionInput=Readonly<{
 operationId:string;requestId:string;decision:PaidSlotDecision;reason:string;
}>;
export type PaidSlotDecisionAck=Readonly<{
 code:'ACADEMY_PAID_SLOT_DECIDED'|'ACADEMY_PAID_SLOT_DECISION_REPLAY';
 lessonId:string|null;
}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record=(v:unknown):v is Record<string,unknown>=>
 v!==null&&typeof v==='object'&&!Array.isArray(v);
export function parsePaidSlotDecisionAck(raw:unknown,status:number,
 decision:PaidSlotDecision):PaidSlotDecisionAck{
 if(!record(raw)||Object.keys(raw).some(k=>!['code','lessonId','requestId'].includes(k))||
  (raw.requestId!==undefined&&(typeof raw.requestId!=='string'||raw.requestId.length>128))||
  !Object.hasOwn(raw,'lessonId')||
  !((status===201&&raw.code==='ACADEMY_PAID_SLOT_DECIDED')||
    (status===200&&raw.code==='ACADEMY_PAID_SLOT_DECISION_REPLAY'))||
  (decision==='approved'?
   typeof raw.lessonId!=='string'||!UUID.test(raw.lessonId):
   raw.lessonId!==null))
  throw new AdminPaidSlotError('INVALID_PAID_SLOT_DECISION_ACK',status);
 return {code:raw.code as PaidSlotDecisionAck['code'],lessonId:raw.lessonId as string|null};
}
export async function submitPaidSlotDecision(input:PaidSlotDecisionInput):
 Promise<PaidSlotDecisionAck>{
 if(!UUID.test(input.operationId)||!UUID.test(input.requestId)||
  !['approved','rejected'].includes(input.decision)||
  input.reason.trim()!==input.reason||input.reason.length<8||input.reason.length>500)
  throw new AdminPaidSlotError('INVALID_PAID_SLOT_DECISION_INPUT',400);
 let response:Response;
 try{
  response=await fetch('/v1/staff/academy/paid-slot-decisions',{
   method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
   headers:{'Content-Type':'application/json'},body:JSON.stringify(input)
  });
 }catch{throw new AdminPaidSlotError('NETWORK_OUTCOME_UNKNOWN');}
 let raw:unknown;
 try{raw=await response.json();}
 catch{throw new AdminPaidSlotError('NETWORK_OUTCOME_UNKNOWN',response.status);}
 if(!response.ok){
  const code=record(raw)&&typeof raw.code==='string'&&
   /^[A-Z_]{1,64}$/.test(raw.code)?raw.code:'PAID_SLOT_DECISION_UNAVAILABLE';
  throw new AdminPaidSlotError(code,response.status);
 }
 return parsePaidSlotDecisionAck(raw,response.status,input.decision);
}
