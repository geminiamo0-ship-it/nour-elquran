import {afterEach,describe,expect,it,vi} from 'vitest';
import {fetchAdminOverview,parseAdminOverview,AdminOverviewError} from './admin-overview-client';
const valid={code:'STAFF_OVERVIEW',asOfMs:1793600000000,readOnly:true,
 metrics:{activeLearners:15,activeQualifiedTeachers:3,upcomingLessons:4,completedLessons:11}};
afterEach(()=>vi.unstubAllGlobals());
const respond=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status});
describe('staff-only readonly overview client (#302)',()=>{
 it('accepts only four exact nonnegative integer facts from verified server',()=>{
  expect(parseAdminOverview(valid)).toEqual({asOfMs:1793600000000,metrics:valid.metrics});
  for(const bad of [
   {...valid,readOnly:false},{...valid,code:'SAMPLE_OVERVIEW'},
   {...valid,metrics:{...valid.metrics,revenues:100}},
   {...valid,metrics:{...valid.metrics,activeLearners:-1}},
   {...valid,metrics:{...valid.metrics,completedLessons:2.5}},
   {...valid,metrics:{...valid.metrics,upcomingLessons:'4'}},
   {...valid,metrics:null},{...valid,asOfMs:'yesterday'},
  ])expect(()=>parseAdminOverview(bad)).toThrow(AdminOverviewError);
 });
 it('uses one read-only same-origin signed GET; sends no role or learner IDs',async()=>{
  const mock=vi.fn().mockResolvedValue(respond(200,valid));vi.stubGlobal('fetch',mock);
  const result=await fetchAdminOverview();
  expect(result.metrics.activeLearners).toBe(15);
  expect(mock.mock.calls[0]?.[0]).toBe('/v1/staff/overview');
  expect(mock.mock.calls[0]?.[1]).toMatchObject({method:'GET',
   credentials:'same-origin',cache:'no-store',redirect:'error'});
  expect(mock.mock.calls[0]?.[1]).not.toHaveProperty('body');
 });
 it('never replaces 403, 404, 503, bad JSON or network errors with zeros',async()=>{
  const mock=vi.fn().mockResolvedValueOnce(respond(403,{code:'STAFF_ACCESS_DENIED'}))
   .mockResolvedValueOnce(respond(404,{code:'NOT_FOUND'}))
   .mockResolvedValueOnce(respond(503,{code:'STAFF_OVERVIEW_UNAVAILABLE'}))
   .mockResolvedValueOnce(new Response('{broken',{status:200}))
   .mockRejectedValueOnce(Error('offline'));
  vi.stubGlobal('fetch',mock);
  for(const [code,status] of [
   ['STAFF_ACCESS_DENIED',403],['NOT_FOUND',404],
   ['STAFF_OVERVIEW_UNAVAILABLE',503],['INVALID_OVERVIEW',200],
   ['NETWORK_UNAVAILABLE',0],
  ] as const){
   try{await fetchAdminOverview();throw Error('must fail');}
   catch(e){
    expect(e).toBeInstanceOf(AdminOverviewError);
    if(e instanceof AdminOverviewError){expect(e.code).toBe(code);expect(e.status).toBe(status);}
   }
  }
 });
});
