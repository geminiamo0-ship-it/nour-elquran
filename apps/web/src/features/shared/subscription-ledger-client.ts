/** #244: factual academic-credit ledger only; no paid booking or receipts. */
export type SubscriptionCycle=Readonly<{
 startsAtMs:number;endsAtMs:number;baseSessions:number;
 rolloverSessions:number;spentSessions:number;recordedUnspentSessions:number;
 state:'within_period'|'expired';
}>;
export type SubscriptionLedger=Readonly<{
 bookingEnabled:false;latestCycle:SubscriptionCycle|null;
 compensationUnspentSessions:number;compensationGrantCount:number;
}>;
export class SubscriptionLedgerError extends Error{
 constructor(readonly code:string,readonly status=0){super(code);}
}
const isObject=(value:unknown):value is Record<string,unknown>=>
 value!==null&&typeof value==='object'&&!Array.isArray(value);
const nonnegative=(value:unknown):value is number=>
 Number.isSafeInteger(value)&&typeof value==='number'&&value>=0;
// Date/Intl throw RangeError outside the ECMAScript timestamp range. Never
// let a malformed D1 cycle crash the signed student home or subscription UI.
const dateTimestamp=(value:unknown):value is number=>
 nonnegative(value)&&value<=8_640_000_000_000_000;
// Worker verifiedOwner accepts legacy/synthetic learner IDs with underscores.
const learnerIdPattern=/^[A-Za-z0-9_-]{1,128}$/;

export function parseSubscriptionLedger(raw:unknown):SubscriptionLedger{
 if(!isObject(raw)||raw.code!=='SUBSCRIPTION_LEDGER'||
  raw.bookingEnabled!==false||
  !nonnegative(raw.compensationUnspentSessions)||
  !nonnegative(raw.compensationGrantCount))
  throw new SubscriptionLedgerError('INVALID_LEDGER_RESPONSE');
 const item=raw.latestCycle;
 let latestCycle:SubscriptionCycle|null=null;
 if(item!==null){
  if(!isObject(item)||!dateTimestamp(item.startsAtMs)||
   !dateTimestamp(item.endsAtMs)||item.endsAtMs<=item.startsAtMs||
   !nonnegative(item.baseSessions)||!nonnegative(item.rolloverSessions)||
   !nonnegative(item.spentSessions)||!nonnegative(item.recordedUnspentSessions)||
   item.baseSessions<1||item.baseSessions>60||item.rolloverSessions>60||
   item.baseSessions+item.rolloverSessions>120||
   item.spentSessions>item.baseSessions+item.rolloverSessions||
   item.recordedUnspentSessions!==
    item.baseSessions+item.rolloverSessions-item.spentSessions||
   (item.state!=='within_period'&&item.state!=='expired'))
   throw new SubscriptionLedgerError('INVALID_LEDGER_RESPONSE');
  latestCycle={
   startsAtMs:item.startsAtMs,endsAtMs:item.endsAtMs,
   baseSessions:item.baseSessions,rolloverSessions:item.rolloverSessions,
   spentSessions:item.spentSessions,
   recordedUnspentSessions:item.recordedUnspentSessions,
   state:item.state as SubscriptionCycle['state'],
  };
 }
 return {
  bookingEnabled:false,latestCycle,
  compensationUnspentSessions:raw.compensationUnspentSessions,
  compensationGrantCount:raw.compensationGrantCount,
 };
}

export const subscriptionLedgerClient={
 owner:async(learnerId:string,signal?:AbortSignal):Promise<SubscriptionLedger>=>{
  if(!learnerIdPattern.test(learnerId))
   throw new SubscriptionLedgerError('INVALID_LEARNER');
  let response:Response;
  try{
   response=await fetch('/v1/me/learners/'+encodeURIComponent(learnerId)+
    '/subscription-ledger',{method:'GET',credentials:'same-origin',
     cache:'no-store',redirect:'error',...(signal?{signal}:{})});
  }catch{throw new SubscriptionLedgerError('NETWORK_UNAVAILABLE');}
  // A ledger is an authoritative full D1 snapshot, not a partial/accepted
  // response. Do not render balances from 201/202/206 or a proxy 2xx.
  if(response.status>=200&&response.status<300&&response.status!==200)
   throw new SubscriptionLedgerError('INVALID_LEDGER_RESPONSE',response.status);
  let payload:unknown;
  try{payload=await response.json();}
  catch{throw new SubscriptionLedgerError('INVALID_LEDGER_RESPONSE',response.status);}
  if(!isObject(payload))
   throw new SubscriptionLedgerError('INVALID_LEDGER_RESPONSE',response.status);
  if(!response.ok)
   throw new SubscriptionLedgerError(typeof payload.code==='string'?
    payload.code:'LEDGER_UNAVAILABLE',response.status);
  return parseSubscriptionLedger(payload);
 }
};
