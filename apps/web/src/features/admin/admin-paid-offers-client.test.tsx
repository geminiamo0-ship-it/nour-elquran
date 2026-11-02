import {afterEach,describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminPaidSlotError} from './admin-paid-slot-client';
import {AdminPaidOffers,createPaidOfferWriteGate} from './AdminPaidOffers';
import {parseAdminPaidOffers,parsePaidOfferAck,submitPaidOfferAction,
 fetchAdminPaidOffers} from './admin-paid-offers-client';
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const C='33333333-3333-4333-8333-333333333333';
const row={offerId:A,teacherId:B,teacherName:'Synthetic Sheikh',
 startsAtMs:1793600000000,endsAtMs:1793602400000,state:'published'};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status});
afterEach(()=>vi.unstubAllGlobals());

describe('#317 signed staff paid offer contracts',()=>{
 it('keeps one staff operation across double taps, unknown ACK and signed refresh',()=>{
  const gate=createPaidOfferWriteGate();
  // React has not committed disabled=true between two submit events.
  expect(gate.begin()).toBe(true);
  expect(gate.begin()).toBe(false);
  expect(gate.begin(true)).toBe(false);
  expect(gate.reset()).toBe(false);
  // Unknown D1 result must preserve the exact operationId for replay.
  gate.finish(true);
  expect(gate.begin()).toBe(false);
  expect(gate.reset()).toBe(false);
  expect(gate.begin(true)).toBe(true);
  expect(gate.begin(true)).toBe(false);
  expect(gate.reset()).toBe(false);
  // Even a confirmed ACK must not unlock before fresh staff GET succeeds.
  gate.finish(false);
  expect(gate.begin()).toBe(false);
  expect(gate.begin(true)).toBe(false);
  expect(gate.reset()).toBe(true);
  expect(gate.begin()).toBe(true);
  expect(gate.begin()).toBe(false);
  // A definitive denial also needs an explicit authoritative refresh.
  gate.finish(false);
  expect(gate.begin()).toBe(false);
  expect(gate.reset()).toBe(true);
  expect(gate.begin()).toBe(true);
 });
 it('rejects malformed, duplicate, private and oversized rows',()=>{
  expect(parseAdminPaidOffers({code:'ACADEMY_PAID_SLOT_STAFF_OFFERS',
   offers:[row],requestId:'trace'})).toHaveLength(1);
  for(const offers of [
   [row,row],[{...row,phone:'private'}],
   [{...row,endsAtMs:row.endsAtMs-1}],
   [{...row,state:'active'}],
   [{...row,teacherName:''}],
   Array.from({length:101},()=>row)
  ])expect(()=>parseAdminPaidOffers({
   code:'ACADEMY_PAID_SLOT_STAFF_OFFERS',offers
  })).toThrow(AdminPaidSlotError);
 });
 it('accepts only matching status/code and UUID for publish and withdrawal ACK',()=>{
  expect(parsePaidOfferAck({code:'ACADEMY_PAID_OFFER_PUBLISHED',offerId:A},
   201,'publish').id).toBe(A);
  expect(parsePaidOfferAck({code:'ACADEMY_PAID_OFFER_REPLAY',offerId:A},
   200,'publish').id).toBe(A);
  expect(parsePaidOfferAck({code:'ACADEMY_PAID_OFFER_WITHDRAWN',withdrawalId:C},
   201,'withdraw').id).toBe(C);
  for(const [raw,status,kind] of [
   [{code:'ACADEMY_PAID_OFFER_PUBLISHED',offerId:A},200,'publish'],
   [{code:'ACADEMY_PAID_OFFER_WITHDRAWN',withdrawalId:C},201,'publish'],
   [{code:'ACADEMY_PAID_OFFER_WITHDRAWN',withdrawalId:'bad'},201,'withdraw'],
   [{code:'ACADEMY_PAID_OFFER_PUBLISHED',offerId:A,phone:'private'},201,'publish']
  ] as const)expect(()=>parsePaidOfferAck(raw,status,kind))
   .toThrow(AdminPaidSlotError);
 });
 it('uses signed no-store GET and exact allowlisted POST payload',async()=>{
  const mock=vi.fn()
   .mockResolvedValueOnce(reply(200,{code:'ACADEMY_PAID_SLOT_STAFF_OFFERS',
    offers:[row]}))
   .mockResolvedValueOnce(reply(201,{code:'ACADEMY_PAID_OFFER_PUBLISHED',offerId:A}))
   .mockResolvedValueOnce(reply(201,{code:'ACADEMY_PAID_OFFER_WITHDRAWN',withdrawalId:C}));
  vi.stubGlobal('fetch',mock);
  expect(await fetchAdminPaidOffers()).toHaveLength(1);
  const publish={kind:'publish' as const,input:{operationId:C,teacherId:B,
   startsAtMs:row.startsAtMs}};
  await submitPaidOfferAction(publish);
  const withdraw={kind:'withdraw' as const,input:{operationId:C,offerId:A,
   reason:'Teacher unavailable'}};
  await submitPaidOfferAction(withdraw);
  expect(mock.mock.calls[0]?.[1]).toMatchObject({
   method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error'});
  expect(mock.mock.calls[1]?.[0]).toBe('/v1/staff/academy/paid-slot-offers');
  expect(mock.mock.calls[2]?.[0]).toBe('/v1/staff/academy/paid-slot-withdrawals');
  expect(JSON.parse(mock.mock.calls[1]?.[1]?.body as string)).toEqual(publish.input);
  expect(JSON.parse(mock.mock.calls[2]?.[1]?.body as string)).toEqual(withdraw.input);
 });
 it('fails closed for invalid input, server denial and uncertain outcome',async()=>{
  const mock=vi.fn().mockResolvedValueOnce(reply(409,{code:'ACADEMY_PAID_OFFER_DENIED'}))
   .mockRejectedValueOnce(Error('offline'))
   .mockResolvedValueOnce(new Response('invalid',{status:201}));
  vi.stubGlobal('fetch',mock);
  await expect(submitPaidOfferAction({kind:'publish',input:{
   operationId:C,teacherId:'invalid',startsAtMs:row.startsAtMs
  }})).rejects.toMatchObject({status:400});
  expect(mock).not.toHaveBeenCalled();
  const valid={kind:'publish' as const,input:{
   operationId:C,teacherId:B,startsAtMs:row.startsAtMs}};
  await expect(submitPaidOfferAction(valid)).rejects.toMatchObject({status:409});
  await expect(submitPaidOfferAction(valid))
   .rejects.toMatchObject({code:'NETWORK_OUTCOME_UNKNOWN'});
  await expect(submitPaidOfferAction(valid))
   .rejects.toMatchObject({code:'NETWORK_OUTCOME_UNKNOWN'});
 });
 it('initial SSR shows no teacher names, offers or enabled mutations',()=>{
  const session={user:{id:'synthetic-staff',name:'Synthetic Staff'},
   phoneVerified:true};
  const html=renderToStaticMarkup(<AdminPaidOffers session={session}/>);
  expect(html).toContain('جارٍ التحقق من صلاحية الإدارة');
  expect(html).not.toContain('Synthetic Sheikh');
  expect(html).not.toContain('معرّف العرض:');
  expect(html).not.toContain('تأكيد نشر هذا الموعد');
 });
});
