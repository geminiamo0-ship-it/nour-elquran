import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {parseOwnerAcademy,latestPendingAcademyRequest,currentCycleLabel,
 parseSubscriptionLedger,readOwnerAcademy,subscriptionLedgerClient,
 type SubscriptionLedger} from '../../shared';
import {StudentProvider} from '../StudentContext';
import {DEMO_PROFILES} from '../mock-adapter';
import {SubscriptionWorkspace} from './SubscriptionWorkspace';
import {HomeSubscriptionStatus,homeSubscriptionSummary} from './HomeSubscriptionStatus';
import {ConnectedSubscriptionLedger} from './ConnectedSubscriptionLedger';
import {ConnectedAcademyOffers,createAcademyPackageRequestGate,
 createAcademyReadEpoch,classifyAcademyPackageRequestResponse,
 academyPackageRequestBody,AcademyUncertainRequestRecovery} from './ConnectedAcademyOffers';

describe('clean, truthful subscriptions #324',()=>{
 const sample={code:'ACADEMY_OWNER',
  packages:[{versionId:'ver-1',packageId:'pkg-1',title:'باقة ٨ حصص',priceEgp:1600,sessions:8}],
  requests:[{id:'req-1',title:'باقة ٨ حصص',priceEgp:1600,sessions:8,atMs:1760000000000,state:'pending'}],
  whatsappNumber:'201000000000'};
 it('validates actual catalog, request state, and WhatsApp before showing prices',()=>{
  const parsed=parseOwnerAcademy(sample);
  expect(latestPendingAcademyRequest(parsed)?.id).toBe('req-1');
  expect(parsed.packages[0]?.priceEgp).toBe(1600);
  expect(()=>parseOwnerAcademy({...sample,whatsappNumber:'https://example.com'})).toThrow();
  expect(()=>parseOwnerAcademy({...sample,packages:[{...sample.packages[0],priceEgp:-2}]})).toThrow();
  expect(()=>parseOwnerAcademy({...sample,requests:[{...sample.requests[0],state:'paid'}]})).toThrow();
  // Signed JSON arrays such as ['pending'] must never bypass the state
  // discriminant and hide an actual pending request, enabling a duplicate.
  for(const state of [['pending'],['activated'],['rejected']]){
   expect(()=>parseOwnerAcademy({...sample,
    requests:[{...sample.requests[0],state}]}))
    .toThrow('ACADEMY_INVALID_RESPONSE');
  }
  expect(parseOwnerAcademy(sample).requests[0]?.state).toBe('pending');
  // Duplicate server IDs must not silently render ambiguous React keys/history.
  expect(()=>parseOwnerAcademy({...sample,packages:[sample.packages[0],sample.packages[0]]})).toThrow('ACADEMY_INVALID_RESPONSE');
  expect(()=>parseOwnerAcademy({...sample,requests:[sample.requests[0],sample.requests[0]]})).toThrow('ACADEMY_INVALID_RESPONSE');
  // Distinct version/request IDs are insufficient if D1 invariants disagree.
  expect(()=>parseOwnerAcademy({...sample,packages:[sample.packages[0],
   {...sample.packages[0],versionId:'ver-2'}]})).toThrow('ACADEMY_INVALID_RESPONSE');
  expect(()=>parseOwnerAcademy({...sample,requests:[sample.requests[0],
   {...sample.requests[0],id:'req-2'}]})).toThrow('ACADEMY_INVALID_RESPONSE');
 });
 it('uses the Worker learner-ID allowlist for both signed reads without widening package IDs',async()=>{
  const ledger={code:'SUBSCRIPTION_LEDGER',bookingEnabled:false,latestCycle:null,
   compensationUnspentSessions:0,compensationGrantCount:0};
  const fetchMock=vi.fn(async (url:string)=>({
   ok:true,json:async()=>url.endsWith('/academy')?sample:ledger
  }));
  vi.stubGlobal('fetch',fetchMock);
  try{
   const owner=await readOwnerAcademy('synthetic_learner');
   const credits=await subscriptionLedgerClient.owner('synthetic_learner');
   expect(owner.packages).toHaveLength(1);
   expect(credits.bookingEnabled).toBe(false);
   expect(fetchMock.mock.calls.map(([url])=>url)).toEqual([
    '/v1/me/learners/synthetic_learner/academy',
    '/v1/me/learners/synthetic_learner/subscription-ledger'
   ]);
   await expect(readOwnerAcademy('bad/learner')).rejects.toThrow('INVALID_LEARNER');
   await expect(subscriptionLedgerClient.owner('bad/learner')).rejects.toThrow('INVALID_LEARNER');
   expect(fetchMock).toHaveBeenCalledTimes(2);
  }finally{vi.unstubAllGlobals();}
 });
 it('rejects D1 cycle timestamps that would crash Intl.DateTimeFormat in signed views',()=>{
  const valid={code:'SUBSCRIPTION_LEDGER',bookingEnabled:false,
   compensationUnspentSessions:0,compensationGrantCount:0,
   latestCycle:{state:'within_period',startsAtMs:1760000000000,
    endsAtMs:1800000000000,baseSessions:8,rolloverSessions:0,
    spentSessions:1,recordedUnspentSessions:7}};
  expect(parseSubscriptionLedger(valid).latestCycle?.endsAtMs).toBe(1800000000000);
  const beyondDate=8_640_000_000_000_001;
  expect(Number.isSafeInteger(beyondDate)).toBe(true);
  expect(Number.isNaN(new Date(beyondDate).getTime())).toBe(true);
  expect(()=>parseSubscriptionLedger({...valid,latestCycle:{...valid.latestCycle,
   endsAtMs:beyondDate}})).toThrow('INVALID_LEDGER_RESPONSE');
  expect(()=>parseSubscriptionLedger({...valid,latestCycle:{...valid.latestCycle,
   startsAtMs:beyondDate}})).toThrow('INVALID_LEDGER_RESPONSE');
 });
 it('rejects JSON arrays masquerading as a cycle state (#324)',()=>{
  const valid={code:'SUBSCRIPTION_LEDGER',bookingEnabled:false,
   compensationUnspentSessions:0,compensationGrantCount:0,
   latestCycle:{state:'within_period',startsAtMs:1760000000000,
    endsAtMs:1800000000000,baseSessions:8,rolloverSessions:0,
    spentSessions:1,recordedUnspentSessions:7}};
  expect(parseSubscriptionLedger(valid).latestCycle?.state).toBe('within_period');
  // String(['within_period']) used to pass the parser, then the UI received
  // an array instead of the exact discriminant and mislabeled the balance.
  for(const state of [['within_period'],['expired']]){
   expect(()=>parseSubscriptionLedger({...valid,
    latestCycle:{...valid.latestCycle,state}})).toThrow('INVALID_LEDGER_RESPONSE');
  }
 });
 it('does not claim a missing subscription when only the catalog succeeded',()=>{
  const academy=parseOwnerAcademy({...sample,requests:[]});
  const unknown=homeSubscriptionSummary(null,academy,1760000000000);
  expect(unknown.status).toContain('تعذّر التحقق');
  expect(unknown.status).not.toContain('لم يُؤكَّد الاشتراك');
  const pending=homeSubscriptionSummary(null,parseOwnerAcademy(sample),1760000000000);
  expect(pending.status).toContain('قيد المراجعة');
  expect(homeSubscriptionSummary(null,null,1760000000000).status)
   .toContain('تعذّر التحقق');
 });
 it('does not hide an existing learner cycle behind a pending package renewal',()=>{
  const ledger={latestCycle:{
   state:'within_period',endsAtMs:1800000000000,recordedUnspentSessions:3
  }} as unknown as SubscriptionLedger;
  const status=homeSubscriptionSummary(ledger,parseOwnerAcademy(sample),1760000000000);
  expect(status.status).toContain('مسجلة');
  expect(status.detail).toContain('حصص مسجلة غير مستخدمة');
  expect(status.detail).toContain('طلب باقة قيد المراجعة');
  expect(status.status).not.toContain('طلب باقة قيد المراجعة');
  const unknown=homeSubscriptionSummary(null,parseOwnerAcademy(sample),1760000000000);
  expect(unknown.detail).toContain('تعذّر التحقق من رصيد الحصص');
 });
 it('shows separate D1 compensation units even without a subscription cycle',()=>{
  const ledger=parseSubscriptionLedger({code:'SUBSCRIPTION_LEDGER',bookingEnabled:false,
   latestCycle:null,compensationUnspentSessions:2,compensationGrantCount:1});
  const noRequest=homeSubscriptionSummary(ledger,
   parseOwnerAcademy({...sample,requests:[]}),1760000000000);
  expect(noRequest.status).toContain('تعويض');
  expect(noRequest.detail).toContain('حصص تعويض غير مستخدمة');
  expect(noRequest.status).not.toContain('لا توجد دورة');
  const pending=homeSubscriptionSummary(ledger,parseOwnerAcademy(sample),1760000000000);
  expect(pending.status).toContain('تعويض');
  expect(pending.detail).toContain('طلب باقة قيد المراجعة');
  const active={...ledger,latestCycle:{state:'within_period',startsAtMs:1750000000000,
   endsAtMs:1800000000000,baseSessions:8,rolloverSessions:0,spentSessions:3,
   recordedUnspentSessions:5}} as SubscriptionLedger;
  const summary=homeSubscriptionSummary(active,null,1760000000000);
  expect(summary.detail).toContain('حصص تعويض مسجلة');
 });
 it('submits the immutable displayed quote version, never only the mutable package ID',()=>{
  const command=academyPackageRequestBody({
   learnerId:'synthetic_learner',
   operationId:'33333333-3333-4333-8333-333333333333',
   packageId:'11111111-1111-4111-8111-111111111111',
   packageVersionId:'22222222-2222-4222-8222-222222222222'
  });
  expect(Object.keys(command).sort()).toEqual(['operationId','packageId','packageVersionId']);
  expect(command.packageVersionId).not.toBe(command.packageId);
  expect(JSON.stringify(command)).not.toContain('synthetic_learner');
 });
 it('requires the exact D1 create/replay ACK before calling a package request confirmed',()=>{
  const id='11111111-1111-4111-8111-111111111111';
  expect(classifyAcademyPackageRequestResponse(201,{
   code:'ACADEMY_REQUEST_CREATED',academyRequestId:id})).toBe('ack');
  expect(classifyAcademyPackageRequestResponse(200,{
   code:'ACADEMY_REQUEST_REPLAY',academyRequestId:id})).toBe('ack');
  for(const [status,payload] of [
   [201,{code:'ACADEMY_REQUEST_CREATED'}],
   [201,{code:'ACADEMY_REQUEST_CREATED',academyRequestId:'invalid'}],
   [200,{code:'ACADEMY_REQUEST_CREATED',academyRequestId:id}],
   [201,{code:'ACADEMY_REQUEST_REPLAY',academyRequestId:id}],
   [201,{code:'ACADEMY_REQUEST_CREATED',academyRequestId:id,paid:true}],
   // The Worker never returns `requestId`: an unexpected extra field must
   // not be mistaken for a durable financial/academy acknowledgement.
   [200,{code:'ACADEMY_REQUEST_REPLAY',academyRequestId:id,requestId:'synthetic'}],
   [201,{code:'ACADEMY_REQUEST_CREATED',academyRequestId:id,requestId:null}],
   [408,null],[425,null],[429,null],[503,{code:'ACADEMY_UNAVAILABLE'}],
   [0,null]
  ] as const)expect(classifyAcademyPackageRequestResponse(status,payload))
   .toBe('uncertain');
  for(const status of [400,401,403,404,409,422])
   expect(classifyAcademyPackageRequestResponse(status,{code:'ACADEMY_REQUEST_DENIED'}))
    .toBe('denied');
 });
 it('remounts both signed subscription balances before a sibling switch can paint old D1 data',()=>{
  const homeA=HomeSubscriptionStatus({learnerId:'synthetic-learner-a'});
  const homeB=HomeSubscriptionStatus({learnerId:'synthetic-learner-b'});
  expect(homeA.key).toBe('synthetic-learner-a');
  expect(homeB.key).toBe('synthetic-learner-b');
  expect(homeA.type).toBe(homeB.type);
  const ledgerA=ConnectedSubscriptionLedger({learnerId:'synthetic-learner-a'});
  const ledgerB=ConnectedSubscriptionLedger({learnerId:'synthetic-learner-b'});
  expect(ledgerA.key).toBe('synthetic-learner-a');
  expect(ledgerB.key).toBe('synthetic-learner-b');
  expect(ledgerA.type).toBe(ledgerB.type);
  // Switching from the visual preview to signed data must also remount.
  expect(HomeSubscriptionStatus({preview:true,learnerId:'synthetic-learner-a'}).key)
   .toBe('preview');
 });
 it('isolates the complete package write gate and owner-read view on sibling switch',()=>{
  // The outer wrapper has no hooks: React remounts the keyed inner component,
  // so an old learner's pending POST/GET cannot update the new learner's view.
  const first=ConnectedAcademyOffers({learnerId:'synthetic-learner-a'});
  const sibling=ConnectedAcademyOffers({learnerId:'synthetic-learner-b'});
  expect(first.key).toBe('synthetic-learner-a');
  expect(sibling.key).toBe('synthetic-learner-b');
  expect(first.type).toBe(sibling.type);
  expect(first.props.learnerId).toBe('synthetic-learner-a');
  expect(sibling.props.learnerId).toBe('synthetic-learner-b');
 });
 it('rejects old catalog GET results before React effect cleanup on refresh or POST',()=>{
  const epoch=createAcademyReadEpoch();
  const initial=epoch.start();
  expect(epoch.isCurrent(initial)).toBe(true);
  epoch.invalidate(); // synchronous refresh click, before cleanup
  expect(epoch.isCurrent(initial)).toBe(false);
  const refreshed=epoch.start();
  expect(epoch.isCurrent(refreshed)).toBe(true);
  epoch.invalidate(); // write starts before that GET settles
  expect(epoch.isCurrent(refreshed)).toBe(false);
  const afterAck=epoch.start();
  expect(epoch.isCurrent(afterAck)).toBe(true);
  epoch.invalidate(); // unmount / sibling switch
  expect(epoch.isCurrent(afterAck)).toBe(false);
 });
 it('keeps exact-operation recovery visible independently of failed catalog GET (#324)',()=>{
  // This recovery UI is rendered outside loading/error/ready catalog branches.
  // Its callback is bound to the original immutable PackageAttempt, not a new request.
  const html=renderToStaticMarkup(<AcademyUncertainRequestRecovery onRetry={()=>{}}/>);
  expect(html).toContain('role="alert"');
  expect(html).toContain('إعادة نفس طلب الباقة');
  expect(html).toContain('دون إنشاء طلب آخر');
  expect(html).not.toContain('اطلب الباقة');
 });
 it('latches one operationId across double taps, ambiguous outcomes and explicit replay',()=>{
  const gate=createAcademyPackageRequestGate();
  expect(gate.begin()).toBe(true);
  expect(gate.begin()).toBe(false);
  expect(gate.begin(true)).toBe(false);
  gate.finish(true);
  expect(gate.status()).toBe('uncertain');
  expect(gate.releaseAfterRead()).toBe(false);
  expect(gate.begin()).toBe(false);
  expect(gate.begin(true)).toBe(true);
  expect(gate.begin(true)).toBe(false);
  gate.finish(false);
  expect(gate.status()).toBe('closed');
  expect(gate.begin()).toBe(false);
  expect(gate.begin(true)).toBe(false);
  // A confirmed ACK still needs a signed D1 read of the immutable request.
  expect(gate.releaseAfterRead()).toBe(true);
  expect(gate.begin()).toBe(true);
  gate.finish(false);
  expect(gate.releaseAfterRead()).toBe(true);
 });
 it('labels unused units from an expired cycle as historical, not available credit',()=>{
  const expired={latestCycle:{state:'expired',endsAtMs:1750000000000,
   recordedUnspentSessions:3},compensationUnspentSessions:2} as SubscriptionLedger;
  const summary=homeSubscriptionSummary(expired,null,1760000000000);
  expect(summary.status).toContain('انتهت');
  expect(summary.detail).toContain('حصص غير مستخدمة من دورة منتهية');
  expect(summary.detail).toContain('انتهت في');
  expect(summary.detail).toContain('حصص تعويض مسجلة');
  expect(summary.detail).not.toContain('حصص مسجلة غير مستخدمة · حتى');
 });
 it('never calls expired academic units an active subscription',()=>{
  expect(currentCycleLabel('expired',1800000000000,1760000000000)).toContain('انتهت');
  expect(currentCycleLabel('within_period',1750000000000,1760000000000)).toContain('انتهت');
  expect(currentCycleLabel('within_period',1800000000000,1760000000000)).toContain('مسجلة');
 });
 it('previews package design without a paid balance, price or payment action',()=>{
  const html=renderToStaticMarkup(<StudentProvider liveLearners={DEMO_PROFILES}
   initialSelectedId="demo-active"><SubscriptionWorkspace/></StudentProvider>);
  expect(html).toContain('الاشتراك والباقات');
  expect(html).toContain('معاينة فقط');
  expect(html).not.toContain('١٬٦٠٠');
  expect(html).not.toContain('تأكيد الدفع');
  expect(html).not.toContain('wa.me/');
 });
 it('shows one compact home link to the visual subscription route',()=>{
  const html=renderToStaticMarkup(<HomeSubscriptionStatus preview basePath="/preview/student"/>);
  expect(html).toContain('href="/preview/student/subscription"');
  expect(html).toContain('معاينة الباقات');
  expect(html).not.toContain('تم الدفع');
 });
 it('signed initial render remains safely pending, without fabricated zero or paid status',()=>{
  const ledger=renderToStaticMarkup(<ConnectedSubscriptionLedger learnerId="child-a"/>);
  const offers=renderToStaticMarkup(<ConnectedAcademyOffers learnerId="child-a"/>);
  expect(ledger).toContain('جارٍ التحقق من سجل هذا الطالب');
  expect(offers).toContain('جارٍ تحميل الباقات');
  expect(ledger+offers).not.toContain('اشتراك نشط');
  expect(ledger+offers).not.toContain('تم الدفع');
  expect(ledger+offers).not.toContain('0 حصص');
 });
});
