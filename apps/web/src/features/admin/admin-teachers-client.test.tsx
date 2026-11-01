import {afterEach,describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminTeacherDirectory} from './AdminTeacherDirectory';
import {AdminTeachersError,fetchAdminTeachers,parseAdminTeachers} from './admin-teachers-client';
const teacher={id:'teacher-1',name:'شيخ تجريبي',qualified:true,status:'active',
 currentLearners:2,upcomingLessons:3};
const good={code:'STAFF_TEACHER_DIRECTORY',asOfMs:1793600000000,
 readOnly:true,teachers:[teacher],truncated:false};
const respond=(status:number,payload:unknown)=>
 new Response(JSON.stringify(payload),{status});
afterEach(()=>vi.unstubAllGlobals());
describe('Admin teacher directory #305',()=>{
 it('accepts only bounded validated server facts and no PII fields',()=>{
  expect(parseAdminTeachers(good)).toEqual({
   asOfMs:good.asOfMs,teachers:[teacher],truncated:false,
  });
  for(const bad of [
   {...good,readOnly:false},{...good,code:'DEMO'},
   {...good,teachers:[{...teacher,phone:'private'}]},
   {...good,teachers:[{...teacher,qualified:1}]},
   {...good,teachers:[{...teacher,currentLearners:-1}]},
   {...good,teachers:[{...teacher,upcomingLessons:'3'}]},
   {...good,teachers:[{...teacher,name:' '}]},
   {...good,teachers:[{...teacher,id:'../../bad'}]},
   {...good,teachers:[teacher,teacher]},
   {...good,truncated:true},
   {...good,teachers:Array.from({length:51},(_,i)=>({...teacher,id:'teacher-'+i}))},
   {...good,teachers:null},{...good,asOfMs:NaN},
  ])expect(()=>parseAdminTeachers(bad)).toThrow(AdminTeachersError);
 });
 it('only sends same-origin signed GET without role claims or identifiers',async()=>{
  const mock=vi.fn().mockResolvedValue(respond(200,good));vi.stubGlobal('fetch',mock);
  expect((await fetchAdminTeachers()).teachers).toHaveLength(1);
  expect(mock.mock.calls[0]?.[0]).toBe('/v1/staff/teachers');
  expect(mock.mock.calls[0]?.[1]).toMatchObject({method:'GET',
   credentials:'same-origin',cache:'no-store',redirect:'error'});
  expect(mock.mock.calls[0]?.[1]).not.toHaveProperty('body');
 });
 it('never turns auth/network/unavailable errors into empty success',async()=>{
  const mock=vi.fn().mockResolvedValueOnce(respond(403,{code:'STAFF_ACCESS_DENIED'}))
   .mockResolvedValueOnce(respond(503,{code:'STAFF_TEACHERS_UNAVAILABLE'}))
   .mockResolvedValueOnce(new Response('{broken',{status:200}))
   .mockRejectedValueOnce(Error('offline'));
  vi.stubGlobal('fetch',mock);
  for(const code of ['STAFF_ACCESS_DENIED','STAFF_TEACHERS_UNAVAILABLE',
   'INVALID_TEACHER_DIRECTORY','NETWORK_UNAVAILABLE']){
   await expect(fetchAdminTeachers()).rejects.toMatchObject({code});
  }
 });
 it('server-rendered initial state is loading, not synthetic records',()=>{
  const html=renderToStaticMarkup(<AdminTeacherDirectory
   session={{user:{id:'staff-1',name:'Synthetic'},phoneVerified:true}}/>);
  expect(html).toContain('جارٍ قراءة سجل الشيوخ');
  expect(html).not.toContain('شيخ تجريبي');
  expect(html).not.toContain('موقوف');
 });
});
