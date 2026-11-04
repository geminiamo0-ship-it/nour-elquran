import {describe,expect,it} from 'vitest';
import {academyAdminOutcomeIsUncertain,academyAdminSameSession,
 academyAdminSessionLockIsBusy,academyAdminPendingForActor} from './AdminAcademyMvp';

describe('admin academy manual settlement retry semantics #315',()=>{
 it('preserves the original operation for ambiguous D1/proxy HTTP outcomes',()=>{
  for(const status of [408,425,429,500,502,503,504,599])
   expect(academyAdminOutcomeIsUncertain(status)).toBe(true);
 });
 it('does not turn a proven validation/permission conflict into a retry',()=>{
  for(const status of [400,401,403,404,409,422])
   expect(academyAdminOutcomeIsUncertain(status)).toBe(false);
 });
});

describe('admin academy async session isolation #315',()=>{
 it('rejects an old in-flight staff response after a session swap',()=>{
  const oldSession={subject:'synthetic-staff',token:'first'};
  const newSession={subject:'synthetic-staff',token:'second'};
  expect(academyAdminSameSession(oldSession,oldSession)).toBe(true);
  expect(academyAdminSameSession(oldSession,newSession)).toBe(false);
  // Even a new session for the same subject cannot inherit a stale receipt.
  expect(academyAdminSameSession(oldSession,{...oldSession})).toBe(false);
  expect(academyAdminSessionLockIsBusy(null,oldSession)).toBe(false);
  expect(academyAdminSessionLockIsBusy(oldSession,oldSession)).toBe(true);
  expect(academyAdminSessionLockIsBusy(oldSession,newSession)).toBe(false);
  expect(academyAdminSessionLockIsBusy(oldSession,{...oldSession})).toBe(false);
 });
});

describe('admin academy same-actor uncertain operation recovery #315',()=>{
 it('keeps the exact payload and operationId across a new session for the same actor',()=>{
  const payload={operationId:'44444444-4444-4444-8444-444444444444',
   learnerId:'11111111-1111-4111-8111-111111111111',manualConfirmed:true};
  const pending={actorId:'synthetic-staff-a',path:'activate',payload};
  const restored=academyAdminPendingForActor(pending,'synthetic-staff-a');
  expect(restored).toBe(pending);
  expect(restored?.payload).toBe(payload);
  expect((restored?.payload as typeof payload).operationId).toBe(payload.operationId);
 });
 it('does not transfer an unresolved payment operation to a different staff account',()=>{
  const pending={actorId:'synthetic-staff-a',path:'activate',
   payload:{operationId:'44444444-4444-4444-8444-444444444444'}};
  expect(academyAdminPendingForActor(pending,'synthetic-staff-b')).toBeNull();
  expect(academyAdminPendingForActor(null,'synthetic-staff-a')).toBeNull();
 });
});
