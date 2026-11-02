import {afterEach,describe,expect,it,vi} from 'vitest';
import {AdminPaidSlotError} from './admin-paid-slot-client';
import {parsePaidSlotDecisionAck,submitPaidSlotDecision}
 from './admin-paid-slot-decision-client';
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const input={operationId:A,requestId:B,decision:'approved' as const,
 reason:'Verified available teacher and balance'};
const response=(status:number,body:unknown)=>
 new Response(JSON.stringify(body),{status});
afterEach(()=>vi.unstubAllGlobals());

describe('#317 signed staff paid-slot decision',()=>{
 it('requires exact ACK, correct state and UUID, never invents a booking',()=>{
  expect(parsePaidSlotDecisionAck({code:'ACADEMY_PAID_SLOT_DECIDED',lessonId:B},
   201,'approved')).toEqual({code:'ACADEMY_PAID_SLOT_DECIDED',lessonId:B});
  expect(parsePaidSlotDecisionAck({code:'ACADEMY_PAID_SLOT_DECISION_REPLAY',
   lessonId:null},200,'rejected').lessonId).toBeNull();
  for(const [status,raw,decision] of [
   [201,{code:'ACADEMY_PAID_SLOT_DECIDED',lessonId:null},'approved'],
   [201,{code:'ACADEMY_PAID_SLOT_DECIDED',lessonId:B},'rejected'],
   [200,{code:'ACADEMY_PAID_SLOT_DECIDED',lessonId:B},'approved'],
   [201,{code:'ACADEMY_PAID_SLOT_DECIDED',lessonId:'invalid'},'approved'],
   [201,{code:'ACADEMY_PAID_SLOT_DECIDED',lessonId:B,phone:'private'},'approved'],
   [201,{code:'ACADEMY_PAID_SLOT_DECIDED'},'rejected'],
  ] as const)expect(()=>parsePaidSlotDecisionAck(raw,status,decision))
   .toThrow(AdminPaidSlotError);
 });
 it('POSTs the exact staff decision without browser role or timestamp',async()=>{
  const mock=vi.fn().mockResolvedValue(response(201,{
   code:'ACADEMY_PAID_SLOT_DECIDED',lessonId:B,requestId:'trace'}));
  vi.stubGlobal('fetch',mock);
  expect(await submitPaidSlotDecision(input)).toMatchObject({lessonId:B});
  expect(mock.mock.calls[0]?.[0]).toBe('/v1/staff/academy/paid-slot-decisions');
  expect(mock.mock.calls[0]?.[1]).toMatchObject({
   method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
   headers:{'Content-Type':'application/json'},body:JSON.stringify(input)
  });
 });
 it('rejects invalid inputs before network and fails closed on denial/outage',async()=>{
  const mock=vi.fn().mockResolvedValueOnce(response(409,{
   code:'ACADEMY_PAID_SLOT_DECISION_DENIED'}))
   .mockRejectedValueOnce(Error('offline'))
   .mockResolvedValueOnce(new Response('{bad',{status:201}));
  vi.stubGlobal('fetch',mock);
  await expect(submitPaidSlotDecision({...input,reason:'bad'}))
   .rejects.toMatchObject({status:400});
  expect(mock).not.toHaveBeenCalled();
  await expect(submitPaidSlotDecision(input))
   .rejects.toMatchObject({status:409,code:'ACADEMY_PAID_SLOT_DECISION_DENIED'});
  await expect(submitPaidSlotDecision(input))
   .rejects.toMatchObject({code:'NETWORK_OUTCOME_UNKNOWN'});
  await expect(submitPaidSlotDecision(input))
   .rejects.toMatchObject({code:'NETWORK_OUTCOME_UNKNOWN'});
 });
});
