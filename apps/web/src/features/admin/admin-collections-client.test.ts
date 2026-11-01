import {afterEach,describe,expect,it,vi} from 'vitest';
import {fetchAdminCollection,parseAdminCollection,AdminCollectionError,
 type AdminDataView} from './admin-collections-client';
const row={
 students:{id:'learner-a',name:'طالب تجريبي',learnerType:'child',status:'active',lessonCount:2},
 schedule:{id:'lesson-a',startsAtMs:1793600000000,kind:'trial',status:'scheduled',
  learnerName:'طالب تجريبي',teacherName:'شيخ تجريبي'},
 subscriptions:{id:'cycle-a',learnerName:'طالب تجريبي',startsAtMs:1793600000000,
  endsAtMs:1796192000000,baseSessions:8,rolloverSessions:1,spentSessions:2},
 attendance:{id:'appeal-a',submittedAtMs:1793600000000,kind:'student_no_show',
  decision:'pending'},
};
afterEach(()=>vi.unstubAllGlobals());
const response=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status});
for(const view of Object.keys(row) as AdminDataView[]){
 describe('Admin '+view+' fixed D1 list',()=>{
  const fixture={code:'STAFF_COLLECTION',view,readOnly:true,
   requestId:'test-request',asOfMs:1793600000000,truncated:false,rows:[row[view]]};
  it('accepts exact rows and rejects private or fabricated fields',()=>{
   expect(parseAdminCollection(view,fixture).rows).toEqual([row[view]]);
   for(const bad of [
    {...fixture,rows:[{...row[view],phone:'private'}]},
    {...fixture,rows:[{...row[view],id:''}]},
    {...fixture,rows:[row[view],row[view]]},
    {...fixture,rows:[row[view]],truncated:true},
    {...fixture,rows:Array.from({length:51},()=>row[view])},
    {...fixture,readOnly:false},{...fixture,view:'finance'},
    {...fixture,requestId:{}},{...fixture,studentNames:['private']},
   ])expect(()=>parseAdminCollection(view,bad)).toThrow(AdminCollectionError);
  });
  it('only uses a signed no-store same-origin GET',async()=>{
   const mock=vi.fn().mockResolvedValue(response(200,fixture));
   vi.stubGlobal('fetch',mock);
   expect((await fetchAdminCollection(view)).rows).toHaveLength(1);
   expect(mock.mock.calls[0]?.[0]).toBe('/v1/staff/collections?view='+view);
   expect(mock.mock.calls[0]?.[1]).toMatchObject({
    method:'GET',cache:'no-store',credentials:'same-origin',redirect:'error'});
   expect(mock.mock.calls[0]?.[1]).not.toHaveProperty('body');
  });
  it('never turns denied or broken responses into empty records',async()=>{
   const mock=vi.fn().mockResolvedValueOnce(response(403,{code:'STAFF_ACCESS_DENIED'}))
    .mockResolvedValueOnce(new Response('{broken',{status:200}))
    .mockRejectedValueOnce(Error('offline'));
   vi.stubGlobal('fetch',mock);
   for(const status of [403,200,0]){
    try{await fetchAdminCollection(view);throw Error('should reject');}
    catch(e){expect(e).toBeInstanceOf(AdminCollectionError);
     if(e instanceof AdminCollectionError)expect(e.status).toBe(status);}
   }
  });
 });
}
