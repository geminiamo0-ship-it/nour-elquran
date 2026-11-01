import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ConnectedClassroomLessons} from './components/ConnectedClassroomLessons';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {fetchPaidSlotRequests,parsePaidSlotRequests,PaidSlotRequestsError,
 parsePaidSlotProposalAck,submitPaidSlotProposal} from
 './paid-slot-requests-client';
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
