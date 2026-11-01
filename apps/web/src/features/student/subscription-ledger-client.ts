/** Authenticated read-only D1 academic-credit projection for student subscriptions.
 * Nothing here enables paid booking, renewal, payments or a fabricated balance.
 */
export type SubscriptionLedgerView=Readonly<{
 code:'SUBSCRIPTION_LEDGER';
 bookingEnabled:false;
 latestCycle:null|Readonly<{
  startsAtMs:number; endsAtMs:number; baseSessions:number;
  rolloverSessions:number; spentSessions:number; recordedUnspentSessions:number;
  state:'within_period'|'expired';
 }>;
 compensationUnspentSessions:number;
 compensationGrantCount:number;
}>;
export class SubscriptionLedgerError extends Error{
 constructor(readonly code:string){super(code);}
}
const id=/^[A-Za-z0-9_-]{1,128}$/;
function object(value:unknown):value is Record<string,unknown>{
 return value!==null&&typeof value==='object'&&!Array.isArray(value);
}
function count(value:unknown){
 return Number.isSafeInteger(value)&&Number(value)>=0&&Number(value)<=100000;
}
function timestamp(value:unknown){
 return Number.isSafeInteger(value)&&Number(value)>=0;
}
export function parseSubscriptionLedger(raw:unknown):SubscriptionLedgerView{
 if(!object(raw)||raw.code!=='SUBSCRIPTION_LEDGER'||raw.bookingEnabled!==false||
    !count(raw.compensationUnspentSessions)||!count(raw.compensationGrantCount)||
    !Object.hasOwn(raw,'latestCycle')){
  throw new SubscriptionLedgerError('INVALID_SUBSCRIPTION_RESPONSE');
 }
 let latestCycle:SubscriptionLedgerView['latestCycle']=null;
 if(raw.latestCycle!==null){
  const c=raw.latestCycle;
  if(!object(c)||
     !['startsAtMs','endsAtMs'].every(k=>timestamp(c[k]))||
     !['baseSessions','rolloverSessions','spentSessions',
       'recordedUnspentSessions'].every(k=>count(c[k]))||
     !['within_period','expired'].includes(String(c.state))||
     Number(c.endsAtMs)<=Number(c.startsAtMs)||
     Number(c.spentSessions)>Number(c.baseSessions)+Number(c.rolloverSessions)||
     Number(c.recordedUnspentSessions)!==
       Number(c.baseSessions)+Number(c.rolloverSessions)-Number(c.spentSessions)){
    throw new SubscriptionLedgerError('INVALID_SUBSCRIPTION_RESPONSE');
  }
  latestCycle={
   startsAtMs:Number(c.startsAtMs),endsAtMs:Number(c.endsAtMs),
   baseSessions:Number(c.baseSessions),rolloverSessions:Number(c.rolloverSessions),
   spentSessions:Number(c.spentSessions),
   recordedUnspentSessions:Number(c.recordedUnspentSessions),
   state:c.state as 'within_period'|'expired',
  };
 }
 return {code:'SUBSCRIPTION_LEDGER',bookingEnabled:false,
  latestCycle,compensationUnspentSessions:Number(raw.compensationUnspentSessions),
  compensationGrantCount:Number(raw.compensationGrantCount)};
}
export async function getSignedSubscriptionLedger(learnerId:string,signal?:AbortSignal){
 if(!id.test(learnerId))throw new SubscriptionLedgerError('INVALID_LEARNER');
 let response:Response;
 try{
  response=await fetch('/v1/me/learners/'+encodeURIComponent(learnerId)+'/subscription-ledger',{
   method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal,
  });
 }catch{
  throw new SubscriptionLedgerError('SUBSCRIPTION_UNAVAILABLE');
 }
 if(!response.ok)throw new SubscriptionLedgerError('SUBSCRIPTION_UNAVAILABLE');
 let data:unknown;
 try{data=await response.json();}
 catch{throw new SubscriptionLedgerError('INVALID_SUBSCRIPTION_RESPONSE');}
 return parseSubscriptionLedger(data);
}
