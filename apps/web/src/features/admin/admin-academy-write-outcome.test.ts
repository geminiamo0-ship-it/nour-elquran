import {describe,expect,it} from 'vitest';
import {academyAdminOutcomeIsUncertain,academyAdminAckIsVerified} from './admin-academy-write-outcome';

describe('staff academy D1 receipt integrity #315',()=>{
 it('holds immutable operations after uncertain HTTP outcomes',()=>{
  for(const status of [408,425,429,500,502,503,504,599])
   expect(academyAdminOutcomeIsUncertain(status)).toBe(true);
  for(const status of [400,401,403,404,422])
   expect(academyAdminOutcomeIsUncertain(status)).toBe(false);
  for(const code of ['', 'ACADEMY_PACKAGE_DENIED','ACADEMY_ACTIVATION_DENIED'])
   expect(academyAdminOutcomeIsUncertain(409,code)).toBe(true);
  for(const code of ['ACADEMY_REQUEST_MISMATCH','ACADEMY_OPERATION_CONFLICT',
   'ACADEMY_INVITE_ALREADY_ISSUED'])
   expect(academyAdminOutcomeIsUncertain(409,code)).toBe(false);
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
