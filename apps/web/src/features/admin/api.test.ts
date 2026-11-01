import {expect,it} from 'vitest';
import {AdminAccessError,parseAdminCapabilities} from './api';

it('accepts only explicit signed staff capability booleans',()=>{
 expect(parseAdminCapabilities({
  code:'STAFF_CAPABILITIES',permissions:{manageTeachers:true,reviewAttendance:false},
 })).toEqual({manageTeachers:true,reviewAttendance:false});
});
it('rejects untrusted role claims, no grants and malformed payloads',()=>{
 const valid={code:'STAFF_CAPABILITIES',
  permissions:{manageTeachers:true,reviewAttendance:false}};
 for(const raw of [
  {...valid,permissions:{manageTeachers:false,reviewAttendance:false}},
  {...valid,permissions:{manageTeachers:'true',reviewAttendance:false}},
  {...valid,permissions:{manageTeachers:true,reviewAttendance:false,admin:true}},
  {...valid,code:'OWNER_CAPABILITIES'},
  {role:'admin'},null,[],
 ])expect(()=>parseAdminCapabilities(raw)).toThrow(AdminAccessError);
});
