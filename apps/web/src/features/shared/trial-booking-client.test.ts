import {afterEach,describe,expect,it,vi} from 'vitest';
import {parseTrialAvailability,trialBookingClient} from './trial-booking-client';
const slot={slotId:'6145a6fa-1d94-4994-91e7-5819692ba3b6',
 startsAtMs:1800000000000,endsAtMs:1800002400000,
 instructionMinutes:30,reservationMinutes:40};
const respond=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status});
afterEach(()=>vi.unstubAllGlobals());
describe('signed first free trial API',()=>{
 it('accepts only official exact 30/40-minute real slot entries',()=>{
  expect(parseTrialAvailability({code:'TRIAL_SLOTS',eligible:true,slots:[slot]}))
   .toEqual({eligible:true,slots:[slot]});
  expect(()=>parseTrialAvailability({code:'TRIAL_SLOTS',eligible:false,slots:[slot]})).toThrow();
  expect(()=>parseTrialAvailability({code:'TRIAL_SLOTS',eligible:true,slots:[slot,slot]})).toThrow();
  expect(()=>parseTrialAvailability({code:'TRIAL_SLOTS',eligible:true,slots:[{...slot,endsAtMs:slot.startsAtMs+1800000}]})).toThrow();
  expect(()=>parseTrialAvailability({code:'TRIAL_SLOTS',eligible:true,slots:[{...slot,teacherName:'Anonymous'}]})).toThrow();
 });
 it('guardian scoped GET has no client-supplied teacher or payment information',async()=>{
  const mock=vi.fn().mockResolvedValue(respond(200,{code:'TRIAL_SLOTS',eligible:true,slots:[slot]}));
  vi.stubGlobal('fetch',mock);
  expect(await trialBookingClient.availability('child-a')).toEqual({eligible:true,slots:[slot]});
  expect(mock.mock.calls[0]?.[0]).toBe('/v1/me/learners/child-a/trial-slots');
  expect(mock.mock.calls[0]?.[1]).toMatchObject({
   method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error'});
  await expect(trialBookingClient.availability('../sibling')).rejects.toThrow('INVALID_LEARNER');
 });
 it('reserving uses exactly slotId+operationId and confirms server assigned lesson',async()=>{
  const mock=vi.fn().mockResolvedValue(respond(201,{
   code:'TRIAL_BOOKED',lessonId:'7145a6fa-1d94-4994-91e7-5819692ba3b6'}));
  vi.stubGlobal('fetch',mock);
  expect(await trialBookingClient.book('child-a',slot.slotId,
   '2145a6fa-1d94-4994-91e7-5819692ba3b6')).toBe('7145a6fa-1d94-4994-91e7-5819692ba3b6');
  expect(mock.mock.calls[0]?.[0]).toBe('/v1/me/learners/child-a/trial-bookings');
  expect(JSON.parse(mock.mock.calls[0]?.[1]?.body)).toEqual({
   slotId:slot.slotId,operationId:'2145a6fa-1d94-4994-91e7-5819692ba3b6'});
 });
 it('409 and invalid confirmation are failures, not optimistic bookings',async()=>{
  const mock=vi.fn().mockResolvedValueOnce(respond(409,{code:'TRIAL_SLOT_UNAVAILABLE'}))
   .mockResolvedValueOnce(respond(201,{code:'TRIAL_BOOKED',lessonId:'forged'}));
  vi.stubGlobal('fetch',mock);
  await expect(trialBookingClient.book('child-a',slot.slotId,
    '2145a6fa-1d94-4994-91e7-5819692ba3b6'))
   .rejects.toThrow('TRIAL_SLOT_UNAVAILABLE');
  await expect(trialBookingClient.book('child-a',slot.slotId,
    '2145a6fa-1d94-4994-91e7-5819692ba3b6'))
   .rejects.toThrow('INVALID_TRIAL_RESPONSE');
 });
});
