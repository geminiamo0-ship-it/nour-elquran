import {describe,expect,it} from 'vitest';
import {academyAdminOutcomeIsUncertain,academyAdminAckIsVerified,
 academyAdminCanReject} from './admin-academy-write-outcome';

describe('staff academy D1 receipt integrity #315',()=>{
 it('holds immutable operations after uncertain HTTP outcomes',()=>{
  for(const status of [408,425,429,500,502,503,504,599])
   expect(academyAdminOutcomeIsUncertain(status)).toBe(true);
  // An edge can replace a committed POST's ACK with any generic 4xx.
  // Unknown or malformed receipts must NOT free the original operationId.
  for(const status of [0,400,401,403,404,405,408,409,422,425,429])
   expect(academyAdminOutcomeIsUncertain(status)).toBe(true);
  for(const [status,code] of [
   [400,'ACADEMY_INVALID_PACKAGE'],[400,'ACADEMY_INVALID_ACTIVATION'],
   [400,'ACADEMY_INVALID_REJECTION'],[400,'ACADEMY_INVALID_CONTACT'],
   [400,'ACADEMY_INVALID_INVITE'],[401,'UNAUTHENTICATED'],
   [403,'BAD_ORIGIN'],[403,'STAFF_ACCESS_DENIED'],
   [404,'NOT_FOUND'],[405,'METHOD_NOT_ALLOWED'],
  ] as const){
   expect(academyAdminOutcomeIsUncertain(status,code)).toBe(false);
   // Even a familiar code in a body with extra fields is not a Worker receipt.
   expect(academyAdminOutcomeIsUncertain(status,code,false)).toBe(true);
  }
  for(const code of ['', 'ACADEMY_PACKAGE_DENIED','ACADEMY_ACTIVATION_DENIED'])
   expect(academyAdminOutcomeIsUncertain(409,code)).toBe(true);
  for(const code of ['ACADEMY_REQUEST_MISMATCH','ACADEMY_OPERATION_CONFLICT',
   'ACADEMY_INVITE_ALREADY_ISSUED']){
   expect(academyAdminOutcomeIsUncertain(409,code)).toBe(false);
   expect(academyAdminOutcomeIsUncertain(409,code,false)).toBe(true);
  }
  // A wrong code/status pairing, even if both are individually familiar,
  // is not a deterministic refusal from the academy Worker.
  expect(academyAdminOutcomeIsUncertain(403,'UNAUTHENTICATED')).toBe(true);
  expect(academyAdminOutcomeIsUncertain(400,'STAFF_ACCESS_DENIED')).toBe(true);
  expect(academyAdminOutcomeIsUncertain(422,'ACADEMY_INVALID_PACKAGE')).toBe(true);
 });
 it('never accepts a proxy 2xx or mismatched package acknowledgement',()=>{
  const packageId='11111111-1111-4111-8111-111111111111';
  const command={packageId};
  expect(academyAdminAckIsVerified('packages',201,
   {code:'ACADEMY_PACKAGE_SAVED',packageId},command)).toBe(true);
  expect(academyAdminAckIsVerified('packages',200,
   {code:'ACADEMY_PACKAGE_REPLAY',packageId},command)).toBe(true);
  for(const [status,body] of [
   [202,{code:'ACADEMY_PACKAGE_SAVED',packageId}],
   [201,{code:'ACADEMY_PACKAGE_REPLAY',packageId}],
   [201,{code:'ACADEMY_PACKAGE_SAVED',packageId:'other'}],
   [201,{code:'ACADEMY_PACKAGE_SAVED'}],
  ] as const)expect(academyAdminAckIsVerified('packages',status,body,command)).toBe(false);
 });
 it('requires exact Worker ACK fields for every staff write path',()=>{
  const packageId='11111111-1111-4111-8111-111111111111';
  const pkg={code:'ACADEMY_PACKAGE_SAVED',packageId};
  const activation={code:'ACADEMY_SUBSCRIPTION_ACTIVATED',
   startsAtMs:1700000000000,endsAtMs:1702600000000,rolloverSessions:0};
  const invite={code:'ACADEMY_INVITE_ISSUED',token:'a'.repeat(64),
   expiresAtMs:Date.now()+86400000};
  const receipts=[
   {path:'packages',status:201,body:pkg,command:{packageId}},
   {path:'packages',status:200,
    body:{code:'ACADEMY_PACKAGE_REPLAY',packageId},command:{packageId}},
   {path:'activate',status:201,body:activation,command:{}},
   {path:'activate',status:200,body:{code:'ACADEMY_ACTIVATION_REPLAY'},command:{}},
   {path:'reject',status:201,body:{code:'ACADEMY_REQUEST_REJECTED'},command:{}},
   {path:'reject',status:200,body:{code:'ACADEMY_REQUEST_REJECTION_REPLAY'},command:{}},
   {path:'contact',status:201,body:{code:'ACADEMY_WHATSAPP_SAVED'},command:{}},
   {path:'contact',status:200,body:{code:'ACADEMY_CONTACT_REPLAY'},command:{}},
   {path:'invites',status:201,body:invite,command:{}}
  ] as const;
  for(const receipt of receipts){
   const {path,status,body,command}=receipt;
   expect(academyAdminAckIsVerified(path,status,body,command)).toBe(true);
   // Even a valid-looking code with a second field must remain unresolved.
   expect(academyAdminAckIsVerified(path,status,{...body,paid:true},command))
    .toBe(false);
   const {code:unused,...withoutCode}=body;
   expect(academyAdminAckIsVerified(path,status,withoutCode,command)).toBe(false);
  }
  expect(academyAdminAckIsVerified('activate',201,{
   ...activation,endsAtMs:undefined},{})).toBe(false);
  expect(academyAdminAckIsVerified('invites',201,{
   ...invite,token:undefined},{})).toBe(false);
 });
 it('validates activation cycle and one-time invite expiry before releasing retry',()=>{
  const good={code:'ACADEMY_SUBSCRIPTION_ACTIVATED',
   startsAtMs:1700000000000,endsAtMs:1702600000000,rolloverSessions:0};
  expect(academyAdminAckIsVerified('activate',201,good,{})).toBe(true);
  expect(academyAdminAckIsVerified('activate',201,
   {...good,endsAtMs:Number.MAX_SAFE_INTEGER},{})).toBe(false);
  expect(academyAdminAckIsVerified('activate',200,
   {code:'ACADEMY_ACTIVATION_REPLAY'},{})).toBe(true);
  const invite={code:'ACADEMY_INVITE_ISSUED',token:'a'.repeat(64),
   expiresAtMs:Date.now()+7*86400000};
  expect(academyAdminAckIsVerified('invites',201,invite,{})).toBe(true);
  expect(academyAdminAckIsVerified('invites',201,
   {...invite,token:'invalid'},{})).toBe(false);
 });
});

describe('staff request rejection audit guard #315',()=>{
 const rows=[{id:'synthetic-pending',state:'pending'},
  {id:'synthetic-activated',state:'activated'},
  {id:'synthetic-rejected',state:'rejected'}];
 it('allows only a confirmed pending signed D1 request with a bounded reason',()=>{
  expect(academyAdminCanReject(rows,'synthetic-pending','Reviewed manually',true,false)).toBe(true);
  for(const id of ['synthetic-activated','synthetic-rejected','unknown',''])
   expect(academyAdminCanReject(rows,id,'Reviewed manually',true,false)).toBe(false);
  expect(academyAdminCanReject([], 'synthetic-pending','Reviewed manually',true,false)).toBe(false);
 });
 it('does not bypass native form constraints with a click',()=>{
  for(const note of ['', '   ', 'too short', 'a'.repeat(501)])
   expect(academyAdminCanReject(rows,'synthetic-pending',note,true,false)).toBe(false);
  expect(academyAdminCanReject(rows,'synthetic-pending','Reviewed manually',false,false)).toBe(false);
  expect(academyAdminCanReject(rows,'synthetic-pending','Reviewed manually',true,true)).toBe(false);
  expect(academyAdminCanReject(rows,'synthetic-pending','   Reviewed manually   ',true,false)).toBe(true);
 });
});
