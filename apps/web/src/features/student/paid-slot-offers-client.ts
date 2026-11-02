/** #317: signed D1 availability only. Offers are not bookings or credits. */
import {PaidSlotRequestsError} from './paid-slot-requests-client';

export type PaidSlotOffer=Readonly<{
 offerId:string;teacherId:string;cycleId:string;
 startsAtMs:number;endsAtMs:number;
}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record=(v:unknown):v is Record<string,unknown>=>
 v!==null&&typeof v==='object'&&!Array.isArray(v);
const ms=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
const fields=['offerId','teacherId','cycleId','startsAtMs','endsAtMs'] as const;
function valid(v:unknown):v is PaidSlotOffer{
 return record(v)&&Object.keys(v).length===fields.length&&
  fields.every(k=>Object.hasOwn(v,k))&&
  typeof v.offerId==='string'&&UUID.test(v.offerId)&&
  typeof v.teacherId==='string'&&UUID.test(v.teacherId)&&
  typeof v.cycleId==='string'&&UUID.test(v.cycleId)&&
  ms(v.startsAtMs)&&ms(v.endsAtMs)&&v.endsAtMs===v.startsAtMs+2400000;
}
export function parsePaidSlotOffers(raw:unknown):readonly PaidSlotOffer[]{
 if(!record(raw)||raw.code!=='ACADEMY_PAID_SLOT_OFFERS'||
  Object.keys(raw).some(k=>!['code','offers','requestId'].includes(k))||
  (raw.requestId!==undefined&&(typeof raw.requestId!=='string'||
   raw.requestId.length>128))||
  !Array.isArray(raw.offers)||raw.offers.length>30)
  throw new PaidSlotRequestsError('INVALID_PAID_SLOT_OFFERS_RESPONSE');
 const seen=new Set<string>();
 const offers:PaidSlotOffer[]=[];
 for(const item of raw.offers){
  if(!valid(item)||seen.has(item.offerId))
   throw new PaidSlotRequestsError('INVALID_PAID_SLOT_OFFERS_RESPONSE');
  seen.add(item.offerId);offers.push(item);
 }
 return offers;
}
export async function fetchPaidSlotOffers(learnerId:string,signal?:AbortSignal):
 Promise<readonly PaidSlotOffer[]>{
 if(!UUID.test(learnerId))throw new PaidSlotRequestsError('INVALID_LEARNER',400);
 let response:Response;
 try{
  response=await fetch('/v1/me/learners/'+encodeURIComponent(learnerId)+
   '/paid-slot-offers',{method:'GET',credentials:'same-origin',cache:'no-store',
    redirect:'error',...(signal?{signal}:{})});
 }catch{throw new PaidSlotRequestsError('NETWORK_UNAVAILABLE');}
 let raw:unknown;
 try{raw=await response.json();}
 catch{throw new PaidSlotRequestsError('INVALID_PAID_SLOT_OFFERS_RESPONSE',response.status);}
 if(!response.ok){
  const code=record(raw)&&typeof raw.code==='string'&&
   /^[A-Z_]{1,64}$/.test(raw.code)?raw.code:'PAID_SLOT_OFFERS_UNAVAILABLE';
  throw new PaidSlotRequestsError(code,response.status);
 }
 return parsePaidSlotOffers(raw);
}
