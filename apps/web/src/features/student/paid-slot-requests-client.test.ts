import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ConnectedClassroomLessons} from './components/ConnectedClassroomLessons';
import {currentLearnerRead} from './components/learner-scope';
import {StudentPaidSlotProposal,proposalFromPublishedOffer,
 canRefreshPaidSlotProposal,resetPaidSlotProposalRefresh,
 createPaidSlotProposalGate,createPaidSlotOfferReadEpoch,
 isUncertainPaidSlotProposalOutcome} from './components/StudentPaidSlotProposal';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {fetchPaidSlotRequests,parsePaidSlotRequests,PaidSlotRequestsError,
 parsePaidSlotProposalAck,submitPaidSlotProposal} from
 './paid-slot-requests-client';
import {fetchPaidSlotOffers,parsePaidSlotOffers} from './paid-slot-offers-client';
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const C='33333333-3333-4333-8333-333333333333';
const row={requestId:A,teacherId:B,startsAtMs:1793600000000,
 endsAtMs:1793602400000,state:'pending',lessonId:null};
const payload={code:'ACADEMY_PAID_SLOT_REQUESTS',requests:[row],requestId:'synthetic'};
const response=(status:number,data:unknown)=>
 new Response(JSON.stringify(data),{status});
afterEach(()=>vi.unstubAllGlobals());
describe('#317 owner paid-slot status',()=>{
 it('parses only the bounded exact D1 contract without cross-profile/PII extras',()=>{
  expect(parsePaidSlotRequests(payload)).toEqual([row]);
  for(const bad of [
   {...payload,requests:[{...row,phone:'private'}]},
   {...payload,requests:[row,row]},
   {...payload,requests:[{...row,teacherId:'bad'}]},
   {...payload,requests:[{...row,endsAtMs:row.endsAtMs+1}]},
   {...payload,requests:[{...row,state:'approved'}]},
   {...payload,requests:[{...row,state:'rejected',lessonId:C}]},
   {...payload,requests:[{...row,state:'approved',lessonId:C,reason:'private'}]},
   {...payload,requests:Array.from({length:31},()=>row)},
   {...payload,learnerName:'private'},
   {...payload,requestId:{}},
  ])expect(()=>parsePaidSlotRequests(bad)).toThrow(PaidSlotRequestsError);
  expect(parsePaidSlotRequests({...payload,requests:[
   {...row,state:'approved',lessonId:C}]})).toHaveLength(1);
  expect(parsePaidSlotRequests({...payload,requests:[
   {...row,state:'expired',lessonId:null}]})).toHaveLength(1);
  expect(()=>parsePaidSlotRequests({...payload,requests:[
   {...row,state:'expired',lessonId:C}]})).toThrow(PaidSlotRequestsError);
 });
 it('uses only signed no-store GET for selected learner',async()=>{
  const mock=vi.fn().mockResolvedValue(response(200,payload));
  vi.stubGlobal('fetch',mock);
  expect(await fetchPaidSlotRequests(A)).toEqual([row]);
  expect(mock.mock.calls[0]?.[0]).toBe('/v1/me/learners/'+A+'/paid-slot-requests');
  expect(mock.mock.calls[0]?.[1]).toMatchObject({
   method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error'});
  expect(mock.mock.calls[0]?.[1]).not.toHaveProperty('body');
  await expect(fetchPaidSlotRequests('not-an-id')).rejects.toMatchObject({
   code:'INVALID_LEARNER',status:400});
  expect(mock).toHaveBeenCalledTimes(1);
 });
 it('does not replace authorization, schema outage or offline errors with empty lists',async()=>{
  const mock=vi.fn().mockResolvedValueOnce(response(404,{code:'NOT_FOUND'}))
   .mockResolvedValueOnce(response(503,{code:'ACADEMY_PAID_SLOT_SCHEMA_NOT_READY'}))
   .mockResolvedValueOnce(new Response('{broken',{status:200}))
   .mockRejectedValueOnce(Error('offline'));
  vi.stubGlobal('fetch',mock);
  for(const [status,code] of [[404,'NOT_FOUND'],
   [503,'ACADEMY_PAID_SLOT_SCHEMA_NOT_READY'],
   [200,'INVALID_PAID_SLOT_RESPONSE'],[0,'NETWORK_UNAVAILABLE']] as const){
   await expect(fetchPaidSlotRequests(A)).rejects.toMatchObject({status,code});
  }
 });
});

// #317 + #322: premium Lessons must retain the signed paid-slot request status.
describe('premium Lessons paid-slot integration',()=>{
 it('renders a signed request loading gate without a fake booking or debit',()=>{
  const html=renderToStaticMarkup(createElement(ConnectedClassroomLessons,{learnerId:A}));
  expect(html).toContain('طلبات مواعيد الحصص المدفوعة');
  expect(html).toContain('جارٍ التحقق من الطلبات');
  expect(html).toContain('حجز حصة تجريبية');
  expect(html).not.toContain('تم اعتماد الحجز');
 });
});


describe('#317 signed guardian paid-slot proposal contract',()=>{
 const input={operationId:A,teacherId:B,cycleId:C,startsAtMs:row.startsAtMs};
 it('accepts only the exact authoritative create or idempotent replay ACK',()=>{
  expect(parsePaidSlotProposalAck({code:'ACADEMY_PAID_SLOT_CREATED',
   slotRequestId:A},201)).toEqual({
    code:'ACADEMY_PAID_SLOT_CREATED',slotRequestId:A});
  expect(parsePaidSlotProposalAck({code:'ACADEMY_PAID_SLOT_REPLAY',
   slotRequestId:A,requestId:'synthetic'},200).slotRequestId).toBe(A);
  for(const [status,data] of [
   [200,{code:'ACADEMY_PAID_SLOT_CREATED',slotRequestId:A}],
   [201,{code:'ACADEMY_PAID_SLOT_REPLAY',slotRequestId:A}],
   [201,{code:'ACADEMY_PAID_SLOT_CREATED',slotRequestId:'invalid'}],
   [201,{code:'ACADEMY_PAID_SLOT_CREATED',slotRequestId:A,learnerName:'private'}],
   [201,{code:'ACADEMY_PAID_SLOT_CREATED',slotRequestId:A,lessonId:C}],
  ] as const)expect(()=>parsePaidSlotProposalAck(data,status)).toThrow(
   PaidSlotRequestsError);
 });
 it('sends a signed exact immutable proposal, not a client payment or booking',async()=>{
  const mock=vi.fn().mockResolvedValue(response(201,{
   code:'ACADEMY_PAID_SLOT_CREATED',slotRequestId:A}));
  vi.stubGlobal('fetch',mock);
  expect(await submitPaidSlotProposal(A,input)).toMatchObject({slotRequestId:A});
  const [url,opts]=mock.mock.calls[0]!;
  expect(url).toBe('/v1/me/learners/'+A+'/paid-slot-requests');
  expect(opts).toMatchObject({method:'POST',credentials:'same-origin',
   cache:'no-store',redirect:'error',
   headers:{'Content-Type':'application/json'}});
  expect(JSON.parse(opts.body)).toEqual(input);
  for(const invalid of [
   {...input,operationId:'invalid'},
   {...input,startsAtMs:'2026-11-01'},
   {...input,paid:true},
  ]){
   await expect(submitPaidSlotProposal(A,invalid as typeof input))
    .rejects.toMatchObject({status:400});
  }
  expect(mock).toHaveBeenCalledTimes(1);
 });
 it('never treats a 409, unconfirmed 503, malformed ACK or offline as booked',async()=>{
  const mock=vi.fn().mockResolvedValueOnce(response(409,{
   code:'ACADEMY_PAID_SLOT_DENIED'}))
   .mockResolvedValueOnce(response(503,{
    code:'ACADEMY_PAID_SLOT_WRITE_UNCONFIRMED'}))
   .mockResolvedValueOnce(response(201,{code:'ACADEMY_PAID_SLOT_CREATED',
    slotRequestId:'not-uuid'}))
   .mockRejectedValueOnce(Error('offline'));
  vi.stubGlobal('fetch',mock);
  for(const [status,code] of [[409,'ACADEMY_PAID_SLOT_DENIED'],
   [503,'ACADEMY_PAID_SLOT_WRITE_UNCONFIRMED'],
   [201,'INVALID_PAID_SLOT_PROPOSAL_ACK'],
   [0,'NETWORK_OUTCOME_UNKNOWN']] as const)
   await expect(submitPaidSlotProposal(A,input)).rejects.toMatchObject({status,code});
  expect(mock).toHaveBeenCalledTimes(4);
  const payloads=mock.mock.calls.map(call=>JSON.parse(call[1].body));
  expect(payloads).toEqual([input,input,input,input]);
 });
});

describe('#317 sibling-switch render-time privacy boundary',()=>{
 it('hides the previous sibling lesson and paid-slot data before useEffect cleanup',()=>{
  const previous={learnerId:A,status:'ready' as const,
   rows:[{id:'synthetic-private-lesson'}]};
  expect(currentLearnerRead(previous,A)).toBe(previous);
  expect(currentLearnerRead(previous,B)).toEqual({
   learnerId:B,status:'loading',rows:[]
  });
  const paidRequests={learnerId:B,status:'ready' as const,rows:[row]};
  expect(currentLearnerRead(paidRequests,A)).toEqual({
   learnerId:A,status:'loading',rows:[]
  });
  expect(currentLearnerRead({learnerId:A,status:'error' as const,rows:[]},B))
   .toMatchObject({learnerId:B,status:'loading',rows:[]});
 });
});

describe('#317 published paid-offer read boundary',()=>{
 const offer={offerId:A,teacherId:B,cycleId:C,
  startsAtMs:1793600000000,endsAtMs:1793602400000};
 const body={code:'ACADEMY_PAID_SLOT_OFFERS',offers:[offer],requestId:'synthetic'};
 it('accepts only exact bounded D1 offer rows and rejects duplicate/PII/false windows',()=>{
  expect(parsePaidSlotOffers(body)).toEqual([offer]);
  for(const bad of [
   {...body,offers:[{...offer,phone:'private'}]},
   {...body,offers:[offer,offer]},
   {...body,offers:[{...offer,cycleId:'invalid'}]},
   {...body,offers:[{...offer,endsAtMs:offer.endsAtMs+1}]},
   {...body,offers:Array.from({length:31},()=>offer)},
   {...body,learnerName:'private'},
   {...body,requestId:{}},
  ])expect(()=>parsePaidSlotOffers(bad)).toThrow(PaidSlotRequestsError);
  expect(parsePaidSlotOffers({...body,offers:[]})).toEqual([]);
 });
 it('uses only owner-scoped signed GET, with no invented slots on error',async()=>{
  const mock=vi.fn().mockResolvedValueOnce(response(200,body))
   .mockResolvedValueOnce(response(403,{code:'STAFF_ACCESS_DENIED'}))
   .mockResolvedValueOnce(response(503,{code:'ACADEMY_PAID_SLOT_SCHEMA_NOT_READY'}))
   .mockRejectedValueOnce(Error('offline'));
  vi.stubGlobal('fetch',mock);
  expect(await fetchPaidSlotOffers(A)).toEqual([offer]);
  expect(mock.mock.calls[0]?.[0]).toBe('/v1/me/learners/'+A+'/paid-slot-offers');
  expect(mock.mock.calls[0]?.[1]).toMatchObject({
   method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error'});
  expect(mock.mock.calls[0]?.[1]).not.toHaveProperty('body');
  for(const [status,code] of [[403,'STAFF_ACCESS_DENIED'],
   [503,'ACADEMY_PAID_SLOT_SCHEMA_NOT_READY'],
   [0,'NETWORK_UNAVAILABLE']] as const)
   await expect(fetchPaidSlotOffers(A)).rejects.toMatchObject({status,code});
  await expect(fetchPaidSlotOffers('invalid')).rejects.toMatchObject({
   status:400,code:'INVALID_LEARNER'});
  expect(mock).toHaveBeenCalledTimes(4);
 });
});


describe('#317 trusted published paid-slot form',()=>{
 it('keeps the same guardian proposal on ambiguous HTTP responses',()=>{
  for(const status of [408,425,429,500,503])
   expect(isUncertainPaidSlotProposalOutcome(
    new PaidSlotRequestsError('UPSTREAM_UNAVAILABLE',status))).toBe(true);
  for(const status of [400,401,403,404,409,422])
   expect(isUncertainPaidSlotProposalOutcome(
    new PaidSlotRequestsError('ACADEMY_PAID_SLOT_DENIED',status))).toBe(false);
  expect(isUncertainPaidSlotProposalOutcome(
   new PaidSlotRequestsError('NETWORK_OUTCOME_UNKNOWN'))).toBe(true);
  expect(isUncertainPaidSlotProposalOutcome(
   new PaidSlotRequestsError('INVALID_PAID_SLOT_PROPOSAL_ACK',201))).toBe(true);
  expect(isUncertainPaidSlotProposalOutcome(new Error('offline'))).toBe(true);
 });
 it('prevents competing guardian operationIds before React rerender and protects unknown outcomes',()=>{
  const gate=createPaidSlotProposalGate();
  // The first click synchronously owns the request. A second click cannot
  // replace its immutable operationId even before React disables the button.
  expect(gate.begin()).toBe(true);
  expect(gate.begin()).toBe(false);
  expect(gate.begin(true)).toBe(false);
  expect(gate.reset()).toBe(false);
  // A lost response is NOT permission to refresh or submit a new request.
  gate.finish(true);
  expect(gate.reset()).toBe(false);
  expect(gate.begin()).toBe(false);
  expect(gate.begin(true)).toBe(true);
  expect(gate.begin(true)).toBe(false);
  gate.finish(false);
  expect(gate.begin()).toBe(false);
  expect(gate.begin(true)).toBe(false);
  // Only after a confirmed ACK may the guardian refresh signed D1 offers.
  expect(gate.reset()).toBe(true);
  expect(gate.begin()).toBe(true);
  gate.finish(false);
  expect(gate.reset()).toBe(true);
  // A definitive 4xx denial also requires a fresh authoritative read.
  expect(gate.begin()).toBe(true);
  gate.finish(false);
  expect(gate.begin()).toBe(false);
  expect(gate.reset()).toBe(true);
  expect(gate.begin()).toBe(true);
 });
 it('permits a fresh server read after confirmed submission but never discards an uncertain write',()=>{
  // After staff rejects/approves a confirmed request, the guardian must be
  // able to fetch D1 availability again without reloading the entire page.
  // Unknown network outcomes remain locked to same-operation replay.
  expect(canRefreshPaidSlotProposal('idle')).toBe(true);
  expect(canRefreshPaidSlotProposal('accepted')).toBe(true);
  expect(canRefreshPaidSlotProposal('denied')).toBe(true);
  expect(canRefreshPaidSlotProposal('sending')).toBe(false);
  expect(canRefreshPaidSlotProposal('uncertain')).toBe(false);
 });
 it('rejects a stale signed GET and old confirmed click immediately on refresh',()=>{
  const epoch=createPaidSlotOfferReadEpoch();
  const oldRender=epoch.current();
  const oldGet=epoch.current();
  expect(epoch.isCurrent(oldRender)).toBe(true);
  expect(epoch.isCurrent(oldGet)).toBe(true);
  // Click refresh before React commits its loading state or aborts old GET.
  expect(epoch.invalidate()).toBe(1);
  expect(epoch.isCurrent(oldRender)).toBe(false);
  expect(epoch.isCurrent(oldGet)).toBe(false);
  // A second stale refresh handler cannot overwrite a newer read.
  const newRender=epoch.current();
  expect(epoch.isCurrent(newRender)).toBe(true);
  expect(epoch.invalidate()).toBe(2);
  expect(epoch.isCurrent(newRender)).toBe(false);
  expect(epoch.isCurrent(epoch.current())).toBe(true);
 });
 it('invalidates old offer rows, radio selection and confirmation before re-fetch',()=>{
  // React effects start after a render. The synchronous refresh transition
  // must not leave an already-confirmed stale offer actionable in that gap.
  for(const learnerId of [A,B]){
   expect(resetPaidSlotProposalRefresh(learnerId)).toEqual({
    read:{learnerId,status:'loading',rows:[]},selectedId:'',
    confirmed:false,attempt:null,phase:'idle'
   });
  }
 });
 const offer={offerId:A,teacherId:B,cycleId:C,
  startsAtMs:1793600000000,endsAtMs:1793602400000};
 it('builds a proposal only from a matching signed offer, not arbitrary user IDs',()=>{
  expect(proposalFromPublishedOffer([offer],A,C)).toEqual({
   operationId:C,teacherId:B,cycleId:C,startsAtMs:offer.startsAtMs
  });
  expect(proposalFromPublishedOffer([offer],B,C)).toBeNull();
  expect(proposalFromPublishedOffer([],A,C)).toBeNull();
 });
 it('renders a fail-closed signed loading gate, never fabricated slots or payment',()=>{
  const html=renderToStaticMarkup(createElement(StudentPaidSlotProposal,{
   learnerId:A,onSubmitted:()=>undefined
  }));
  expect(html).toContain('جارٍ قراءة المواعيد المدفوعة المعتمدة');
  expect(html).toContain('لا يخصم من الباقة');
  expect(html).not.toContain('تم تسجيل طلب الموعد');
  expect(html).not.toContain('type="radio"');
  const lessons=renderToStaticMarkup(createElement(ConnectedClassroomLessons,{
   learnerId:A
  }));
  expect(lessons).toContain('طلب موعد حصة مدفوعة');
  expect(lessons).toContain('طلبات مواعيد الحصص المدفوعة');
 });
});
