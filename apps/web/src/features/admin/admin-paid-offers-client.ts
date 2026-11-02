/** #317: Strict signed staff paid-offer contract. Publication is not a booking. */
import {AdminPaidSlotError} from './admin-paid-slot-client';

export type AdminPaidOffer=Readonly<{
 offerId:string;teacherId:string;teacherName:string;
 startsAtMs:number;endsAtMs:number;state:'published'|'withdrawn';
}>;
export type PublishPaidOfferInput=Readonly<{
 operationId:string;teacherId:string;startsAtMs:number;
}>;
export type WithdrawPaidOfferInput=Readonly<{
 operationId:string;offerId:string;reason:string;
}>;
export type PaidOfferAction=
 |{kind:'publish';input:PublishPaidOfferInput}
 |{kind:'withdraw';input:WithdrawPaidOfferInput};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const obj=(v:unknown):v is Record<string,unknown>=>
 v!==null&&typeof v==='object'&&!Array.isArray(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&UUID.test(v);
const ms=(v:unknown):v is number=>typeof v==='number'&&
 Number.isSafeInteger(v)&&v>=0;
const fields=['offerId','teacherId','teacherName','startsAtMs','endsAtMs','state'];
function validOffer(v:unknown):v is AdminPaidOffer{
 return obj(v)&&Object.keys(v).length===fields.length&&
  fields.every(k=>Object.hasOwn(v,k))&&uuid(v.offerId)&&uuid(v.teacherId)&&
  typeof v.teacherName==='string'&&v.teacherName.trim().length>0&&
  v.teacherName.length<=200&&ms(v.startsAtMs)&&ms(v.endsAtMs)&&
  v.endsAtMs===v.startsAtMs+2400000&&
  (v.state==='published'||v.state==='withdrawn');
}
export function parseAdminPaidOffers(raw:unknown):readonly AdminPaidOffer[]{
 if(!obj(raw)||raw.code!=='ACADEMY_PAID_SLOT_STAFF_OFFERS'||
  Object.keys(raw).some(k=>!['code','offers','requestId'].includes(k))||
  (raw.requestId!==undefined&&(typeof raw.requestId!=='string'||
   raw.requestId.length>128))||!Array.isArray(raw.offers)||
  raw.offers.length>100)
  throw new AdminPaidSlotError('INVALID_PAID_OFFERS_RESPONSE');
 const seen=new Set<string>();
 const rows:AdminPaidOffer[]=[];
 for(const row of raw.offers){
  if(!validOffer(row)||seen.has(row.offerId))
   throw new AdminPaidSlotError('INVALID_PAID_OFFERS_RESPONSE');
  seen.add(row.offerId);rows.push(row);
 }
 return rows;
}
async function readJson(response:Response):Promise<unknown>{
 try{return await response.json();}
 catch{throw new AdminPaidSlotError('NETWORK_OUTCOME_UNKNOWN',response.status);}
}
function errorCode(raw:unknown){
 return obj(raw)&&typeof raw.code==='string'&&/^[A-Z_]{1,64}$/.test(raw.code)?
  raw.code:'PAID_OFFER_UNAVAILABLE';
}
export async function fetchAdminPaidOffers(signal?:AbortSignal):
 Promise<readonly AdminPaidOffer[]>{
 let response:Response;
 try{response=await fetch('/v1/staff/academy/paid-slot-offers',{
  method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',
  ...(signal?{signal}:{})
 });}catch{throw new AdminPaidSlotError('NETWORK_UNAVAILABLE');}
 let raw:unknown;
 try{raw=await response.json();}
 catch{throw new AdminPaidSlotError('INVALID_PAID_OFFERS_RESPONSE',response.status);}
 if(!response.ok)throw new AdminPaidSlotError(errorCode(raw),response.status);
 return parseAdminPaidOffers(raw);
}
export function parsePaidOfferAck(raw:unknown,status:number,kind:PaidOfferAction['kind']){
 const published=kind==='publish';
 const idKey=published?'offerId':'withdrawalId';
 const created=published?'ACADEMY_PAID_OFFER_PUBLISHED':'ACADEMY_PAID_OFFER_WITHDRAWN';
 const replay=published?'ACADEMY_PAID_OFFER_REPLAY':'ACADEMY_PAID_WITHDRAWAL_REPLAY';
 if(!obj(raw)||Object.keys(raw).some(k=>!['code',idKey,'requestId'].includes(k))||
  (raw.requestId!==undefined&&(typeof raw.requestId!=='string'||
   raw.requestId.length>128))||!uuid(raw[idKey])||
  !((status===201&&raw.code===created)||(status===200&&raw.code===replay)))
  throw new AdminPaidSlotError('INVALID_PAID_OFFER_ACK',status);
 return {code:raw.code as string,id:raw[idKey] as string};
}
export async function submitPaidOfferAction(action:PaidOfferAction){
 const {input}=action;
 if(!obj(input)||!uuid(input.operationId)||
  (action.kind==='publish'?
   Object.keys(input).length!==3||!uuid(input.teacherId)||
    !ms(input.startsAtMs):
   Object.keys(input).length!==3||!uuid(input.offerId)||
    typeof input.reason!=='string'||input.reason.trim()!==input.reason||
    input.reason.length<8||input.reason.length>500))
  throw new AdminPaidSlotError('INVALID_PAID_OFFER_INPUT',400);
 const path=action.kind==='publish'?'paid-slot-offers':'paid-slot-withdrawals';
 let response:Response;
 try{response=await fetch('/v1/staff/academy/'+path,{
  method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(input)
 });}catch{throw new AdminPaidSlotError('NETWORK_OUTCOME_UNKNOWN');}
 const raw=await readJson(response);
 if(!response.ok)throw new AdminPaidSlotError(errorCode(raw),response.status);
 return parsePaidOfferAck(raw,response.status,action.kind);
}
