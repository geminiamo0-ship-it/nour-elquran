/** ADM-01: no role is trusted from browser state or account profile. */
export type AdminCapabilities=Readonly<{manageTeachers:boolean;reviewAttendance:boolean}>;
export class AdminAccessError extends Error{
 constructor(readonly code:string,readonly status=0){super(code);}
}
const object=(value:unknown):value is Record<string,unknown>=>
 value!==null&&typeof value==='object'&&!Array.isArray(value);

export function parseAdminCapabilities(raw:unknown):AdminCapabilities{
 if(!object(raw)||raw.code!=='STAFF_CAPABILITIES'||!object(raw.permissions)||
  typeof raw.permissions.manageTeachers!=='boolean'||
  typeof raw.permissions.reviewAttendance!=='boolean'||
  Object.keys(raw.permissions).length!==2||
  (!raw.permissions.manageTeachers&&!raw.permissions.reviewAttendance))
  throw new AdminAccessError('INVALID_STAFF_CAPABILITIES');
 return {
  manageTeachers:raw.permissions.manageTeachers,
  reviewAttendance:raw.permissions.reviewAttendance,
 };
}
export const adminApi={
 capabilities:async(signal?:AbortSignal):Promise<AdminCapabilities>=>{
  let response:Response;
  try{
   response=await fetch('/v1/staff/capabilities',{
    method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',
    ...(signal?{signal}:{}),
   });
  }catch{throw new AdminAccessError('NETWORK_UNAVAILABLE');}
  let payload:unknown;
  try{payload=await response.json();}
  catch{throw new AdminAccessError('INVALID_STAFF_CAPABILITIES',response.status);}
  if(!object(payload))throw new AdminAccessError('INVALID_STAFF_CAPABILITIES',response.status);
  if(!response.ok)throw new AdminAccessError(
   response.status===401?'UNAUTHENTICATED':
    response.status===403?'STAFF_ACCESS_DENIED':'STAFF_UNAVAILABLE',response.status);
  return parseAdminCapabilities(payload);
 },
};
