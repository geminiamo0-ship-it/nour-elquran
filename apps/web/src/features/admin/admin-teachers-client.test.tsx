import {afterEach,describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminTeacherDirectory,AdminTeacherReceipt} from './AdminTeacherDirectory';
import {AdminTeacherIdLookup} from './AdminTeacherIdLookup';
import {AdminTeachersError,fetchAdminTeachers,parseAdminTeachers,isAdminTeacherAccessRevoked} from './admin-teachers-client';
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
   {...good,guardianPhone:'private'},
   {...good,authSubject:'private-staff-subject'},
   {...good,unexpected:null},
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

 it('accepts exactly 50 bounded rows and rejects 51 or 101 rows from a malformed receipt',()=>{
  for(const count of [0,1,50]){
   const rows=Array.from({length:count},(_,i)=>({
    ...teacher,id:`teacher-${i}`,
   }));
   const value=parseAdminTeachers({...good,teachers:rows,truncated:count===50});
   expect(value.teachers).toHaveLength(count);
   expect(value.truncated).toBe(count===50);
  }
  for(const count of [51,101]){
   const rows=Array.from({length:count},(_,i)=>({
    ...teacher,id:`teacher-${i}`,
   }));
   expect(()=>parseAdminTeachers({...good,teachers:rows,truncated:true}))
    .toThrow(AdminTeachersError);
  }
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
 it('looks up an exact out-of-page Sheikh using only a signed bounded GET',async()=>{
  const mock=vi.fn().mockResolvedValue(respond(200,{...good,teachers:[{...teacher,id:'teacher-75'}]}));
  vi.stubGlobal('fetch',mock);
  const value=await fetchAdminTeachers(undefined,'teacher-75');
  expect(value.teachers[0]?.id).toBe('teacher-75');
  expect(value.truncated).toBe(false);
  expect(mock.mock.calls[0]?.[0]).toBe('/v1/staff/teachers?id=teacher-75');
  expect(mock.mock.calls[0]?.[1]).toMatchObject({method:'GET',
   credentials:'same-origin',cache:'no-store',redirect:'error'});
  for(const id of ['', '../bad','teacher_75','x'.repeat(129)])
   await expect(fetchAdminTeachers(undefined,id)).rejects.toMatchObject({
    code:'INVALID_TEACHER_LOOKUP',status:400});
  expect(mock).toHaveBeenCalledTimes(1);
 });
 it('rejects stale or mismatched exact-ID success responses before staff selection',async()=>{
  const wrong={...good,teachers:[{...teacher,id:'teacher-74'}]};
  const multiple={...good,teachers:[
   {...teacher,id:'teacher-75'},{...teacher,id:'teacher-74'}]};
  const mock=vi.fn()
   .mockResolvedValueOnce(respond(200,wrong))
   .mockResolvedValueOnce(respond(200,multiple))
   .mockResolvedValueOnce(respond(200,{...good,teachers:[]}))
   .mockResolvedValueOnce(respond(200,{...good,teachers:[{...teacher,id:'teacher-75'}]}));
  vi.stubGlobal('fetch',mock);
  for(let i=0;i<2;i++)
   await expect(fetchAdminTeachers(undefined,'teacher-75')).rejects.toMatchObject({
    code:'INVALID_TEACHER_LOOKUP_RESPONSE',status:200});
  expect((await fetchAdminTeachers(undefined,'teacher-75')).teachers).toEqual([]);
  expect((await fetchAdminTeachers(undefined,'teacher-75')).teachers[0]?.id).toBe('teacher-75');
  expect(mock).toHaveBeenCalledTimes(4);
 });
 it('fresh signed denial invalidates an earlier roster, but storage failures do not',()=>{
  for(const status of [401,403,404])
   expect(isAdminTeacherAccessRevoked(new AdminTeachersError('STAFF_ACCESS_DENIED',status)))
    .toBe(true);
  for(const status of [0,400,409,500,503])
   expect(isAdminTeacherAccessRevoked(new AdminTeachersError('RETRYABLE',status)))
    .toBe(false);
  expect(isAdminTeacherAccessRevoked(Error('offline'))).toBe(false);
  expect(isAdminTeacherAccessRevoked(null)).toBe(false);
 });
 it('renders an accessible exact-ID lookup without personal or fake records',()=>{
  const html=renderToStaticMarkup(<AdminTeacherIdLookup
   session={{user:{id:'staff-1',name:'Synthetic'},phoneVerified:true}}
   onFound={()=>{}} onAccessRevoked={()=>{}}/>);
  expect(html).toContain('admin-exact-teacher-id');
  expect(html).toContain('إظهار الشيخ');
  expect(html).not.toContain('شيخ تجريبي');
  expect(html).not.toContain('private@');
 });
 it('keeps confirmed receipts during refresh but hides them after staff revocation or account switch',()=>{
  const session={user:{id:'staff-1',name:'Synthetic'},phoneVerified:true};
  const other={user:{id:'staff-2',name:'Synthetic'},phoneVerified:true};
  const receipt={session,value:{code:'TEACHER_ROLE_CHANGED',resourceId:'teacher-1'}};
  const render=(denied:boolean,active=session)=>renderToStaticMarkup(
   <AdminTeacherReceipt session={active} receipt={receipt} denied={denied}/>);
  expect(render(false)).toContain('تم تأكيد الإجراء وحفظه');
  expect(render(true)).not.toContain('TEACHER_ROLE_CHANGED');
  expect(render(false,other)).not.toContain('TEACHER_ROLE_CHANGED');
  expect(renderToStaticMarkup(<AdminTeacherReceipt session={session}
   receipt={null} denied={false}/>)).toBe('');
 });
 it('server-rendered initial state is loading, not synthetic records',()=>{
  const html=renderToStaticMarkup(<AdminTeacherDirectory
   session={{user:{id:'staff-1',name:'Synthetic'},phoneVerified:true}}/>);
  expect(html).toContain('جارٍ قراءة سجل الشيوخ');
  expect(html).not.toContain('شيخ تجريبي');
  expect(html).not.toContain('موقوف');
 });
});
