import {afterEach,describe,expect,it,vi} from 'vitest';
import {AdminPaidSlotError,fetchAdminPaidSlots,parseAdminPaidSlots}
 from './admin-paid-slot-client';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const C='33333333-3333-4333-8333-333333333333';
const D='44444444-4444-4444-8444-444444444444';
const row={requestId:A,learnerId:B,learnerName:' Synthetic Learner ',
 teacherId:C,teacherName:'Synthetic Sheikh',startsAtMs:1793600000000,
 endsAtMs:1793602400000,state:'pending',lessonId:null};
const payload={code:'ACADEMY_PAID_SLOT_STAFF',requests:[row],requestId:'synthetic'};
const response=(status:number,data:unknown)=>
 new Response(JSON.stringify(data),{status});
afterEach(()=>vi.unstubAllGlobals());

describe('#317 signed staff paid-slot inbox',()=>{
 it('accepts bounded immutable D1 rows but never coerces or admits PII',()=>{
  expect(parseAdminPaidSlots(payload)).toEqual([row]);
  expect(parseAdminPaidSlots({...payload,requests:[
   {...row,state:'approved',lessonId:D}]})).toHaveLength(1);
  for(const bad of [
   {...payload,requests:[row,row]},
   {...payload,requests:[{...row,phone:'private'}]},
   {...payload,requests:[{...row,learnerId:'not-uuid'}]},
   {...payload,requests:[{...row,learnerName:' '}]},
   {...payload,requests:[{...row,teacherName:'x'.repeat(201)}]},
   {...payload,requests:[{...row,startsAtMs:String(row.startsAtMs)}]},
   {...payload,requests:[{...row,endsAtMs:row.endsAtMs+1}]},
   {...payload,requests:[{...row,state:'approved'}]},
   {...payload,requests:[{...row,state:'rejected',lessonId:D}]},
   {...payload,requests:Array.from({length:101},()=>row)]},
   {...payload,guardianContact:'private'},
   {...payload,requestId:{}},
  ])expect(()=>parseAdminPaidSlots(bad)).toThrow(AdminPaidSlotError);
 });
 it('requests only the staff-authorized no-store endpoint without role spoof',async()=>{
  const mock=vi.fn().mockResolvedValue(response(200,payload));
  vi.stubGlobal('fetch',mock);
  expect(await fetchAdminPaidSlots()).toEqual([row]);
  expect(mock).toHaveBeenCalledTimes(1);
  expect(mock.mock.calls[0]?.[0]).toBe('/v1/staff/academy/paid-slot-requests');
  expect(mock.mock.calls[0]?.[1]).toMatchObject({
   method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error'
  });
  expect(mock.mock.calls[0]?.[1]).not.toHaveProperty('headers');
  expect(mock.mock.calls[0]?.[1]).not.toHaveProperty('body');
 });
 it('never presents 403, schema failures or offline as an empty inbox',async()=>{
  const mock=vi.fn().mockResolvedValueOnce(response(403,{code:'STAFF_ACCESS_DENIED'}))
   .mockResolvedValueOnce(response(503,{code:'ACADEMY_PAID_SLOT_SCHEMA_NOT_READY'}))
   .mockResolvedValueOnce(new Response('{invalid',{status:200}))
   .mockRejectedValueOnce(Error('offline'));
  vi.stubGlobal('fetch',mock);
  for(const [status,code] of [[403,'STAFF_ACCESS_DENIED'],
   [503,'ACADEMY_PAID_SLOT_SCHEMA_NOT_READY'],
   [200,'INVALID_PAID_SLOT_STAFF_RESPONSE'],
   [0,'NETWORK_UNAVAILABLE']] as const){
   await expect(fetchAdminPaidSlots()).rejects.toMatchObject({status,code});
  }
 });
});
