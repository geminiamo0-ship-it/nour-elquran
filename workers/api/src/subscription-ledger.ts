/** #244: authenticated, read-only D1 academic credit ledger.
 * NO payment/activation/paid-booking API is shipped in this slice.
 * Returned counts are audit facts, NOT a permission to book/charge.
 */
import type {CoreDatabase} from './bindings.ts';
import {verifiedOwner} from './published-assignments.ts';

type CycleRow={id:string;startsAtMs:number;endsAtMs:number;
 baseSessions:number;rolloverSessions:number;spentSessions:number};
type CompensationTotals={grantCount:number;totalSessions:number;spentSessions:number};

export async function readOwnerSubscriptionLedger(
 db:CoreDatabase,subject:string,learnerId:string,now=Date.now()
){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(learnerId)||
    !await verifiedOwner(db,subject,learnerId))
  return {status:404,code:'NOT_FOUND'} as const;
 if(!Number.isSafeInteger(now)||now<0)
  return {status:503,code:'CLOCK_UNAVAILABLE'} as const;
 const cycle=await db.prepare(`SELECT c.id,c.starts_at_ms AS startsAtMs,
 c.ends_at_ms AS endsAtMs,c.base_sessions AS baseSessions,
 c.rollover_sessions AS rolloverSessions,
 (SELECT COUNT(*) FROM subscription_spend_events e
  WHERE e.source_kind='cycle' AND e.source_id=c.id) AS spentSessions
 FROM subscription_cycles c WHERE c.learner_id=?
 ORDER BY c.starts_at_ms DESC,c.id DESC LIMIT 1`)
 .bind(learnerId).first<CycleRow>();
 const compensation=await db.prepare(`SELECT COUNT(*) AS grantCount,
 COALESCE(SUM(g.sessions),0) AS totalSessions,
 COALESCE(SUM((SELECT COUNT(*) FROM subscription_spend_events e
  WHERE e.source_kind='compensation' AND e.source_id=g.id)),0) AS spentSessions
 FROM subscription_compensation_grants g WHERE g.learner_id=?`)
 .bind(learnerId).first<CompensationTotals>();
 if((cycle&&(cycle.spentSessions<0||cycle.spentSessions>
      cycle.baseSessions+cycle.rolloverSessions))||
    !compensation||compensation.spentSessions<0||
    compensation.spentSessions>compensation.totalSessions)
  return {status:503,code:'LEDGER_INCONSISTENT'} as const;
 const current=cycle?{
   startsAtMs:cycle.startsAtMs,endsAtMs:cycle.endsAtMs,
   baseSessions:cycle.baseSessions,rolloverSessions:cycle.rolloverSessions,
   spentSessions:cycle.spentSessions,
   recordedUnspentSessions:cycle.baseSessions+cycle.rolloverSessions-cycle.spentSessions,
   state:now>=cycle.startsAtMs&&now<cycle.endsAtMs?'within_period' as const:
     'expired' as const
 }:null;
 return {status:200,code:'SUBSCRIPTION_LEDGER',
  bookingEnabled:false as const,
  latestCycle:current,
  compensationUnspentSessions:compensation.totalSessions-compensation.spentSessions,
  // Lifetime grant count; aggregate across ALL grants (never a truncated list).
  compensationGrantCount:compensation.grantCount,
 } as const;
}
