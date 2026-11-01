import {expect,it} from 'vitest';
import {parseSubscriptionLedger,SubscriptionLedgerError} from './subscription-ledger-client';

const valid={
 code:'SUBSCRIPTION_LEDGER',bookingEnabled:false,
 latestCycle:{startsAtMs:1800000000000,endsAtMs:1802592000000,
  baseSessions:8,rolloverSessions:2,spentSessions:3,
  recordedUnspentSessions:7,state:'within_period'},
 compensationUnspentSessions:2,compensationGrantCount:1,
};
it('accepts only server-confirmed non-bookable academic counts',()=>{
 const parsed=parseSubscriptionLedger(valid);
 expect(parsed.bookingEnabled).toBe(false);
 expect(parsed.latestCycle?.recordedUnspentSessions).toBe(7);
 expect(parsed.compensationUnspentSessions).toBe(2);
});
it('keeps no-cycle zero history truthful, never fabricating an active package',()=>{
 expect(parseSubscriptionLedger({...valid,latestCycle:null,
  compensationUnspentSessions:0,compensationGrantCount:0}).latestCycle).toBeNull();
});
it('rejects bookable, contradictory, negative and malformed ledger responses',()=>{
 const invalid=[
  {...valid,bookingEnabled:true},
  {...valid,latestCycle:{...valid.latestCycle,spentSessions:11}},
  {...valid,latestCycle:{...valid.latestCycle,recordedUnspentSessions:8}},
  {...valid,latestCycle:{...valid.latestCycle,endsAtMs:1799999999999}},
  {...valid,latestCycle:{...valid.latestCycle,state:'paid'}},
  {...valid,compensationUnspentSessions:-1},
  {...valid,latestCycle:undefined},
 ];
 for(const raw of invalid)
  expect(()=>parseSubscriptionLedger(raw)).toThrow(SubscriptionLedgerError);
});
