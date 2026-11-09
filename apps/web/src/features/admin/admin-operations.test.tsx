import {afterEach,describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminOperations,adminOperationConfirmationMatches,adminOperationConfirmationScope,
 adminOperationScopedValue,adminStaffOptionsError,adminTeacherActionTargetIsVerified,
 claimAdminOperationFlight,adminOperationEditField} from './AdminOperations';
import {submitAdminAction,validAdminAction,AdminActionError,isAdminActionStaffRevoked,
 adminStaffSessionRevoked}
 from './admin-operations-client';

const operationId='124e4567-e89b-42d3-a456-426614174000';
const reason='Verified academic action';
const teacher={action:'activate',teacherId:'teacher-1',
 operationId,reason};
const schedule={action:'cancel',resourceId:'scheduled-lesson',
 operationId,reason};
const review={appealId:'appeal-123',decision:'accepted',operationId,
 reason:'Reviewed attendance evidence'};
const respond=(status:number,body:unknown)=>
 new Response(JSON.stringify(body),{status});
afterEach(()=>vi.unstubAllGlobals());
describe('Admin operational D1 client #309',()=>{
 it('keeps signed staff revocation across automatic refresh and isolates new sessions (#314)',()=>{
  const session={user:{id:'synthetic-staff'}};
  const denied={session,revision:0};
  // A post-ACK or missing-row retry may increment revision, but must not
  // revive a roster after the same signed staff session was denied.
  expect(adminStaffSessionRevoked(denied,session)).toBe(true);
  expect(adminStaffSessionRevoked({...denied,revision:7},session)).toBe(true);
  expect(adminStaffSessionRevoked(denied,{...session})).toBe(false);
  // Only the explicit recheck button clears the stored denial.
  expect(adminStaffSessionRevoked(null,session)).toBe(false);
 });
 it('allows only one staff operation per confirmation, including rapid submits and uncertain replay (#314)',()=>{
  const lock:{current:'idle'|'sending'|'uncertain'|'done'}={current:'idle'};
  expect(claimAdminOperationFlight(lock)).toBe(true);
  expect(lock.current).toBe('sending');
  // A second synchronous submit must not generate/send a new operationId.
  expect(claimAdminOperationFlight(lock)).toBe(false);
  expect(claimAdminOperationFlight(lock,true)).toBe(false);
  // Lost network acknowledgement: only an explicit same-command replay.
  lock.current='uncertain';
  expect(claimAdminOperationFlight(lock)).toBe(false);
  expect(claimAdminOperationFlight(lock,true)).toBe(true);
  expect(claimAdminOperationFlight(lock,true)).toBe(false);
  // After a confirmed D1 ACK the previous consent cannot submit again.
  lock.current='done';
  expect(claimAdminOperationFlight(lock)).toBe(false);
  expect(claimAdminOperationFlight(lock,true)).toBe(false);
  // Only a new confirmation (or a definitive rejected request) resets it.
  lock.current='idle';
  expect(claimAdminOperationFlight(lock)).toBe(true);
 });
 it('invalidates consent synchronously before each controlled field update (#314)',()=>{
  const events:string[]=[];
  const clear=()=>events.push('consent-cleared');
  const set=(value:string)=>events.push('field:'+value);
  // Even an edit that restores the old text cannot preserve the old consent.
  adminOperationEditField(clear,set,'changed');
  adminOperationEditField(clear,set,'original');
  expect(events).toEqual([
   'consent-cleared','field:changed',
   'consent-cleared','field:original',
  ]);
 });
 it('binds staff confirmation to the exact actor, target, action and reason (#314)',()=>{
  const actor={user:{id:'staff-a'}};
  const nextSession={user:{id:'staff-a'}};
  const fields=JSON.stringify(['teacher','activate','teacher-51','verified reason']);
  const consent={session:actor,fields};
  expect(adminOperationConfirmationMatches(consent,actor,fields)).toBe(true);
  // The same staff ID in a fresh login is not the same signed session.
  expect(adminOperationConfirmationMatches(consent,nextSession,fields)).toBe(false);
  for(const changed of [
   ['teacher','activate','teacher-52','verified reason'],
   ['teacher','suspend','teacher-51','verified reason'],
   ['teacher','activate','teacher-51','a different reason'],
  ]){
   expect(adminOperationConfirmationMatches(consent,actor,JSON.stringify(changed)))
    .toBe(false);
  }
  expect(adminOperationConfirmationMatches(null,actor,fields)).toBe(false);
 });
 it('invalidates exact Sheikh action consent when fresh signed lookup changes visible facts (#314)',()=>{
  const actor={user:{id:'staff-a'}};
  const fields=['teacher','suspend','','','','teacher-51','','','trial','Verified reason'];
  const selected={id:'teacher-51',name:'Synthetic Sheikh',status:'active' as const,
   qualified:true,currentLearners:0,upcomingLessons:0};
  const unrelated={...selected,id:'teacher-2'};
  const original=adminOperationConfirmationScope(fields,'teacher',
   [selected,unrelated],'teacher-51');
  const consent={session:actor,fields:original};
  expect(adminOperationConfirmationMatches(consent,actor,original)).toBe(true);
  // A new exact-ID receipt changes the facts used for a sensitive transition,
  // even though no editable field (teacher ID, action, reason) changed.
  for(const updated of [
   {...selected,status:'disabled' as const},
   {...selected,qualified:false},
   {...selected,currentLearners:1},
   {...selected,upcomingLessons:1},
   {...selected,name:'Updated Synthetic Sheikh'},
  ]){
   const current=adminOperationConfirmationScope(fields,'teacher',
    [updated,unrelated],'teacher-51');
   expect(adminOperationConfirmationMatches(consent,actor,current)).toBe(false);
  }
  // A removed selected actor must not inherit consent from its old roster row.
  const missing=adminOperationConfirmationScope(fields,'teacher',
   [unrelated],'teacher-51');
  expect(adminOperationConfirmationMatches(consent,actor,missing)).toBe(false);
  // Unrelated lookup results do not needlessly invalidate selected consent.
  const otherChanged=adminOperationConfirmationScope(fields,'teacher',
   [selected,{...unrelated,status:'disabled'}],'teacher-51');
  expect(adminOperationConfirmationMatches(consent,actor,otherChanged)).toBe(true);
  expect(adminOperationConfirmationScope(fields,'schedule',[selected],'teacher-51'))
   .toBe(adminOperationConfirmationScope(fields,'schedule',[],'teacher-51'));
 });
 it('does not allow a new confirmation for a Sheikh removed from the signed roster (#314)',()=>{
  const selected={id:'teacher-51',name:'Synthetic Sheikh',status:'active' as const,
   qualified:true,currentLearners:0,upcomingLessons:0};
  const unrelated={...selected,id:'teacher-2'};
  expect(adminTeacherActionTargetIsVerified('teacher','activate','teacher-51',
   [selected,unrelated])).toBe(true);
  // An old controlled select can still hold an ID after its option disappears.
  // Do not let a fresh checkbox consent turn that stale value into a write.
  for(const action of ['activate','qualify','suspend','revoke_qualification']){
   expect(adminTeacherActionTargetIsVerified('teacher',action,'teacher-51',
    [unrelated])).toBe(false);
   expect(adminTeacherActionTargetIsVerified('teacher',action,'',
    [selected])).toBe(false);
  }
  // Provisioning is by verified auth subject, not a roster teacher ID.
  expect(adminTeacherActionTargetIsVerified('teacher','provision','',[])).toBe(true);
  // Schedule/attendance have independent server-side resource authorization.
  expect(adminTeacherActionTargetIsVerified('schedule','assign','',[])).toBe(true);
  expect(adminTeacherActionTargetIsVerified('attendance','accepted','',[])).toBe(true);
 });
 it('hides old signed staff options and action receipts immediately on session or section change (#314)',()=>{
  const actor={user:{id:'staff-a',name:'Synthetic Staff'},phoneVerified:true};
  // A new login can carry the same user ID but must never inherit old roster data.
  const reauthenticated={user:{id:'staff-a',name:'Synthetic Staff'},phoneVerified:true};
  // The entire editable form must be gated before effect cleanup, not just
  // the signed option lists: old IDs and reasons are sensitive as well.
  const formGate={session:actor,kind:'teacher' as const,value:true as const};
  expect(adminOperationScopedValue(formGate,actor,'teacher')).toBe(true);
  expect(adminOperationScopedValue(formGate,reauthenticated,'teacher')).toBeNull();
  expect(adminOperationScopedValue(formGate,actor,'schedule')).toBeNull();
  const options={students:[{id:'synthetic-learner',name:'Synthetic Learner'}],
   sheikhs:[{id:'synthetic-teacher',name:'Synthetic Sheikh'}]};
  const entry={session:actor,kind:'schedule' as const,value:options};
  expect(adminOperationScopedValue(entry,actor,'schedule')).toEqual(options);
  expect(adminOperationScopedValue(entry,reauthenticated,'schedule')).toBeNull();
  expect(adminOperationScopedValue(entry,actor,'teacher')).toBeNull();
  expect(adminOperationScopedValue(null,actor,'schedule')).toBeNull();
  const pending={session:actor,kind:'teacher' as const,
   value:{phase:'uncertain' as const,operationId,command:teacher}};
  expect(adminOperationScopedValue(pending,actor,'teacher')).toEqual(pending.value);
  expect(adminOperationScopedValue(pending,reauthenticated,'teacher')).toBeNull();
  expect(adminOperationScopedValue(pending,actor,'attendance')).toBeNull();
 });
 it('accepts only exact auditable commands without role headers or accounts',()=>{
  expect(validAdminAction('teacher',teacher)).toBe(true);
  expect(validAdminAction('teacher',{...teacher,action:'provision',
   targetUserId:'verified-account',teacherId:undefined})).toBe(false);
  expect(validAdminAction('schedule',schedule)).toBe(true);
  expect(validAdminAction('attendance',review)).toBe(true);
  for(const bad of [
   {...teacher,grant:'roles.manage'},
   {...teacher,teacherId:'../../fake'},
   {...teacher,reason:'short'},
   {...teacher,operationId:'not-uuid'},
   {...teacher,action:'grant_admin'},
  ])expect(validAdminAction('teacher',bad)).toBe(false);
  expect(validAdminAction('schedule',{...schedule,kind:'standard'})).toBe(false);
  expect(validAdminAction('attendance',{...review,decision:'grant_credit'})).toBe(false);
 });
 it('requires valid future booking time, range and real IDs',()=>{
  const future=Date.now()+3600_000;
  expect(validAdminAction('schedule',{action:'assign',operationId,reason,
   learnerId:'learner-a',teacherId:'teacher-a',
   startsAtMs:future,endsAtMs:future+3600_000})).toBe(true);
  expect(validAdminAction('schedule',{action:'assign',operationId,reason,
   learnerId:'learner-a',teacherId:'teacher-a',
   startsAtMs:future,endsAtMs:future-1})).toBe(false);
  expect(validAdminAction('schedule',{action:'book',operationId,reason,
   learnerId:'learner-a',teacherId:'teacher-a',
   startsAtMs:future,kind:'premium_paid'})).toBe(false);
 });
 it('uses same-origin cookie POST and shows success only from real server ACK',async()=>{
  const mock=vi.fn().mockResolvedValue(respond(200,{code:'TEACHER_ROLE_CHANGED',
   teacherId:'teacher-1',requestId:'server-trace'}));
  vi.stubGlobal('fetch',mock);
  expect(await submitAdminAction('teacher',teacher)).toEqual({
   code:'TEACHER_ROLE_CHANGED',resourceId:'teacher-1'});
  expect(mock.mock.calls[0]?.[0]).toBe('/v1/staff/teachers/transition');
  expect(mock.mock.calls[0]?.[1]).toMatchObject({
   method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
   headers:{'Content-Type':'application/json'}});
  expect(JSON.parse(mock.mock.calls[0]?.[1].body)).toEqual(teacher);
  expect(mock.mock.calls[0]?.[1]).not.toHaveProperty('authorization');
 });
 it('denies revoked roles, unknown success, and refuses fake local ACKs',async()=>{
  const mock=vi.fn().mockResolvedValueOnce(respond(403,{code:'STAFF_ACCESS_DENIED'}))
   .mockResolvedValueOnce(respond(200,{code:'SCHEDULE_ACTION_APPLIED',resourceId:'l1'}))
   .mockResolvedValueOnce(respond(200,{code:'CREDIT_MINTED'}));
  vi.stubGlobal('fetch',mock);
  await expect(submitAdminAction('teacher',teacher)).rejects.toMatchObject({
   code:'STAFF_ACCESS_DENIED',status:403});
  expect(await submitAdminAction('schedule',schedule)).toMatchObject({
   code:'SCHEDULE_ACTION_APPLIED',resourceId:'l1'});
  await expect(submitAdminAction('attendance',review)).rejects.toMatchObject({
   code:'UNKNOWN_SERVER_SUCCESS',uncertain:true});
 });
 it('invalidates schedule option receipts only for signed staff GET 401/403 (#314)',()=>{
  for(const status of [401,403])
   expect(isAdminActionStaffRevoked(adminStaffOptionsError(status))).toBe(true);
  for(const status of [404,409,429,503])
   expect(isAdminActionStaffRevoked(adminStaffOptionsError(status))).toBe(false);
  expect(adminStaffOptionsError(503).code).toBe('STAFF_OPTIONS_UNAVAILABLE');
 });
 it('revokes cached staff UI only for signed auth denial, not business-rule 403 or target 404',()=>{
  for(const e of [new AdminActionError('UNAUTHENTICATED',401),
   new AdminActionError('STAFF_ACCESS_DENIED',403),
   new AdminActionError('UNAUTHENTICATED',403)])
   expect(isAdminActionStaffRevoked(e)).toBe(true);
  for(const e of [new AdminActionError('TEACHER_ROLE_TRANSITION_DENIED',403),
   new AdminActionError('NOT_FOUND',404),
   new AdminActionError('TEACHER_ROLE_GUARD_NOT_READY',503),
   new AdminActionError('NETWORK_OUTCOME_UNKNOWN',0,true),Error('offline')])
   expect(isAdminActionStaffRevoked(e)).toBe(false);
 });
 it('treats network interruption as uncertain rather than as a failed D1 write',async()=>{
  const mock=vi.fn().mockRejectedValue(Error('connection lost'));
  vi.stubGlobal('fetch',mock);
  await expect(submitAdminAction('teacher',teacher)).rejects.toMatchObject({
   code:'NETWORK_OUTCOME_UNKNOWN',uncertain:true});
  expect(mock).toHaveBeenCalledTimes(1);
 });
 it('does not show privileged data or actions before parent role check',()=>{
  const html=renderToStaticMarkup(<AdminOperations kind="teacher"
   session={{user:{id:'verified-staff',name:'Synthetic Staff'},phoneVerified:true}}/>);
  expect(html).toContain('إجراءات الشيوخ');
  expect(html).toContain('disabled');
  expect(html).not.toContain('تم الحفظ');
  expect(html).not.toContain('دفع');
 });
});
