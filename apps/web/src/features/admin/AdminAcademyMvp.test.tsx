import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {academyAdminAckIsVerified,academyAdminOutcomeIsUncertain,academyAdminSameSession,
 academyAdminSessionLockIsBusy,academyAdminPendingForActor,
 academyAdminCommandAllowed,academyAdminSessionViewIsReady,
 academyAdminStaffAccessRevoked,academyAdminReadMayApply,academyAdminReadEpochMayApply,
 academyAdminMutationMayApply,academyAdminCanSend,academyAdminCanRefresh,
 academyAdminCanReject,academyAdminEmptyReadMessage,AdminAcademyMvp} from './AdminAcademyMvp';

describe('admin academy staff revocation and late-read privacy #315',()=>{
 it('hides old staff state only for genuine authorization denial',()=>{
  expect(academyAdminStaffAccessRevoked(401,'UNAUTHENTICATED')).toBe(true);
  expect(academyAdminStaffAccessRevoked(403,'STAFF_ACCESS_DENIED')).toBe(true);
  expect(academyAdminStaffAccessRevoked(403,'ACADEMY_STAFF_ACCESS_CHANGED')).toBe(true);
  expect(academyAdminStaffAccessRevoked(409,'ACADEMY_STAFF_ACCESS_CHANGED')).toBe(true);
  for(const [status,code] of [
   [403,'ACADEMY_ACTIVATION_DENIED'],[403,'ACADEMY_REQUEST_MISMATCH'],
   [404,'STAFF_ACCESS_DENIED'],[409,'ACADEMY_REQUEST_MISMATCH'],
   [503,'STAFF_ACCESS_DENIED'],[0,'NETWORK_OUTCOME_UNKNOWN'],
  ] as const)expect(academyAdminStaffAccessRevoked(status,code)).toBe(false);
 });
 it('never applies an older signed D1 list after a newer staff denial',()=>{
  expect(academyAdminReadMayApply(false,false)).toBe(true);
  expect(academyAdminReadMayApply(true,false)).toBe(false);
  expect(academyAdminReadMayApply(false,true)).toBe(false);
  expect(academyAdminReadMayApply(true,true)).toBe(false);
 });
});

describe('admin academy signed read generation fence #315',()=>{
 it('ignores a delayed post-write list when manual refresh has already started',()=>{
  // Epoch 7 is a post-write read; epoch 8 is the newer user refresh.
  expect(academyAdminReadEpochMayApply(7,8,false,false)).toBe(false);
  expect(academyAdminReadEpochMayApply(8,8,false,false)).toBe(true);
  expect(academyAdminReadEpochMayApply(8,8,true,false)).toBe(false);
  expect(academyAdminReadEpochMayApply(8,8,false,true)).toBe(false);
 });
 it('never lets a pre-write list overwrite the committed command reconciliation',()=>{
  expect(academyAdminReadEpochMayApply(11,12,false,false)).toBe(false);
  expect(academyAdminReadEpochMayApply(12,12,false,false)).toBe(true);
 });
});

describe('admin academy terminal read states #315',()=>{
 it('distinguishes pending signed reads from denied and malformed/unavailable responses',()=>{
  expect(academyAdminEmptyReadMessage('loading')).toContain('جارٍ تحميل');
  expect(academyAdminEmptyReadMessage('error')).toContain('تعذّر تحميل');
  expect(academyAdminEmptyReadMessage('denied')).toContain('إخفاء بيانات الإدارة');
  expect(academyAdminEmptyReadMessage('ready')).toBeNull();
  expect(academyAdminEmptyReadMessage('error')).not.toContain('جارٍ تحميل');
  expect(academyAdminEmptyReadMessage('denied')).not.toContain('جارٍ تحميل');
 });
});

describe('admin academy uncertain-write read recovery #315',()=>{
 it('keeps signed read-only refresh available while an unknown write is held',()=>{
  // A failed GET after session renewal must be recoverable without a reload.
  // The pending operation remains held; this never authorizes a new POST.
  expect(academyAdminCanRefresh('uncertain')).toBe(true);
  expect(academyAdminCanRefresh('error')).toBe(true);
  expect(academyAdminCanRefresh('idle')).toBe(true);
  expect(academyAdminCanRefresh('done')).toBe(true);
  expect(academyAdminCanRefresh('busy')).toBe(false);
  expect(academyAdminCanSend('error',false,false)).toBe(false);
  expect(academyAdminCanSend('loading',false,false)).toBe(false);
  expect(academyAdminCanSend('ready',true,true)).toBe(false);
 });
});

describe('admin academy request rejection safety #315',()=>{
 const requests=[
  {id:'synthetic-pending',state:'pending'},
  {id:'synthetic-activated',state:'activated'},
  {id:'synthetic-rejected',state:'rejected'},
 ];
 it('enables rejection only for a pending signed request with an audit note and confirmation',()=>{
  expect(academyAdminCanReject(requests,'synthetic-pending',
   'Reviewed manually',true,false)).toBe(true);
  for(const id of ['synthetic-activated','synthetic-rejected','unknown','']){
   expect(academyAdminCanReject(requests,id,'Reviewed manually',true,false)).toBe(false);
  }
 });
 it('never sends an empty, short, oversized or unconfirmed rejection',()=>{
  for(const note of ['', '   ', 'too short', 'a'.repeat(501)]){
   expect(academyAdminCanReject(requests,'synthetic-pending',note,true,false)).toBe(false);
  }
  expect(academyAdminCanReject(requests,'synthetic-pending',
   'Reviewed manually',false,false)).toBe(false);
  expect(academyAdminCanReject(requests,'synthetic-pending',
   'Reviewed manually',true,true)).toBe(false);
  expect(academyAdminCanReject([], 'synthetic-pending',
   'Reviewed manually',true,false)).toBe(false);
 });
});

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

describe('admin academy pre-effect privacy gate #315',()=>{
 it('never treats a new staff session as safe to paint old invite/learner fields',()=>{
  const oldSession={user:{id:'staff-a',name:'Synthetic A'},phoneVerified:true};
  const sameActorNewSession={...oldSession};
  const anotherActor={user:{id:'staff-b',name:'Synthetic B'},phoneVerified:true};
  expect(academyAdminSessionViewIsReady(oldSession,oldSession)).toBe(true);
  expect(academyAdminSessionViewIsReady(oldSession,sameActorNewSession)).toBe(false);
  expect(academyAdminSessionViewIsReady(oldSession,anotherActor)).toBe(false);
 });
 it('renders no staff records or one-use invitation on initial server render',()=>{
  const session={user:{id:'synthetic-staff',name:'Synthetic Staff'},phoneVerified:true};
  for(const mode of ['requests','invites','contact','packages'] as const){
   const html=renderToStaticMarkup(<AdminAcademyMvp session={session} mode={mode}/>);
   expect(html).toContain('جارٍ تحميل البيانات');
   expect(html).not.toContain('teacher/join?token=');
   expect(html).not.toContain('تم الاستلام يدويًا');
  }
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
  expect(academyAdminCommandAllowed(pending,'synthetic-staff-a','activate',payload)).toBe(true);
  expect(academyAdminCommandAllowed(pending,'synthetic-staff-a','activate',
   {...payload})).toBe(false);
  expect(academyAdminCommandAllowed(pending,'synthetic-staff-a','packages',payload)).toBe(false);
 });
 it('does not transfer an unresolved payment operation to a different staff account',()=>{
  const pending={actorId:'synthetic-staff-a',path:'activate',
   payload:{operationId:'44444444-4444-4444-8444-444444444444'}};
  expect(academyAdminPendingForActor(pending,'synthetic-staff-b')).toBeNull();
  expect(academyAdminCommandAllowed(pending,'synthetic-staff-b','activate',
   pending.payload)).toBe(true);
  expect(academyAdminPendingForActor(null,'synthetic-staff-a')).toBeNull();
 });
});

describe('admin academy strict durable acknowledgement #315',()=>{
 const cases=[
  ['packages','ACADEMY_PACKAGE_SAVED','ACADEMY_PACKAGE_REPLAY'],
  ['activate','ACADEMY_SUBSCRIPTION_ACTIVATED','ACADEMY_ACTIVATION_REPLAY'],
  ['reject','ACADEMY_REQUEST_REJECTED','ACADEMY_REQUEST_REJECTION_REPLAY'],
  ['contact','ACADEMY_WHATSAPP_SAVED','ACADEMY_CONTACT_REPLAY'],
 ] as const;
 it('accepts only the correct 201 create or 200 immutable replay per command',()=>{
  const packageId='11111111-1111-4111-8111-111111111111';
  for(const [path,created,replayed] of cases){
   const command=path==='packages'?{packageId}:{};
   const ack=(code:string)=>path==='packages'?{code,packageId}:
    path==='activate'&&code==='ACADEMY_SUBSCRIPTION_ACTIVATED'?
     {code,startsAtMs:1700000000000,endsAtMs:1702600000000,rolloverSessions:0}:{code};
   expect(academyAdminAckIsVerified(path,201,ack(created),command)).toBe(true);
   expect(academyAdminAckIsVerified(path,200,ack(replayed),command)).toBe(true);
   expect(academyAdminAckIsVerified(path,200,ack(created),command)).toBe(false);
   expect(academyAdminAckIsVerified(path,201,ack(replayed),command)).toBe(false);
   expect(academyAdminAckIsVerified(path,202,ack(created),command)).toBe(false);
   expect(academyAdminAckIsVerified(path,204,ack(created),command)).toBe(false);
   expect(academyAdminAckIsVerified(path,503,ack(created),command)).toBe(false);
   expect(academyAdminAckIsVerified(path,201,ack('ACADEMY_OPERATION_CONFLICT'),command))
    .toBe(false);
  }
 });
 it('rejects a valid-looking package receipt for another package or missing ID',()=>{
  const command={packageId:'11111111-1111-4111-8111-111111111111'};
  for(const [status,code] of [[201,'ACADEMY_PACKAGE_SAVED'],
   [200,'ACADEMY_PACKAGE_REPLAY']] as const){
   expect(academyAdminAckIsVerified('packages',status,
    {code,packageId:'22222222-2222-4222-8222-222222222222'},command)).toBe(false);
   expect(academyAdminAckIsVerified('packages',status,{code},command)).toBe(false);
   expect(academyAdminAckIsVerified('packages',status,
    {code,packageId:command.packageId},{})).toBe(false);
  }
 });
 it('does not clear a committed activation on a malformed or absent D1 cycle ACK',()=>{
  const code='ACADEMY_SUBSCRIPTION_ACTIVATED';
  const good={code,startsAtMs:1700000000000,endsAtMs:1702600000000,
   rolloverSessions:8};
  expect(academyAdminAckIsVerified('activate',201,good,{})).toBe(true);
  for(const bad of [
   {code},
   {...good,startsAtMs:undefined},
   {...good,startsAtMs:'1700000000000'},
   {...good,startsAtMs:-1},
   {...good,startsAtMs:Number.MAX_SAFE_INTEGER},
   {...good,endsAtMs:good.startsAtMs},
   {...good,endsAtMs:good.startsAtMs-1},
   {...good,endsAtMs:Number.MAX_SAFE_INTEGER},
   {...good,rolloverSessions:undefined},
   {...good,rolloverSessions:-1},
   {...good,rolloverSessions:61},
   {...good,rolloverSessions:1.5},
  ])expect(academyAdminAckIsVerified('activate',201,bad,{})).toBe(false);
  // Replay receipts intentionally omit cycle details and require a fresh read.
  expect(academyAdminAckIsVerified('activate',200,
   {code:'ACADEMY_ACTIVATION_REPLAY'},{})).toBe(true);
 });
 it('requires a newly issued one-use invite token and a valid expiry',()=>{
  const valid={code:'ACADEMY_INVITE_ISSUED',token:'a'.repeat(64),
   expiresAtMs:Date.now()+7*86400000};
  expect(academyAdminAckIsVerified('invites',201,valid,{})).toBe(true);
  for(const invalid of [
   {...valid,token:undefined},{...valid,token:'not-a-token'},
   {...valid,expiresAtMs:0},{...valid,expiresAtMs:Date.now()-60000},
   {...valid,expiresAtMs:'1700000000000'},
   {...valid,expiresAtMs:8_640_000_000_000_001},
   {...valid,expiresAtMs:Number.MAX_SAFE_INTEGER},
   {...valid,expiresAtMs:Date.now()+8*86400000},
   {...valid,code:'ACADEMY_INVITE_ALREADY_ISSUED'},
  ])expect(academyAdminAckIsVerified('invites',201,invalid,{})).toBe(false);
  expect(academyAdminAckIsVerified('invites',200,valid,{})).toBe(false);
 });
 it('fails closed for malformed payloads, unknown routes and cross-command ACKs',()=>{
  for(const raw of [null,[],{},'ok',{code:'ACADEMY_PACKAGE_SAVED'}]){
   expect(academyAdminAckIsVerified('invites',201,raw,{})).toBe(false);
  }
  expect(academyAdminAckIsVerified('activate',201,{code:'ACADEMY_PACKAGE_SAVED'},{})).toBe(false);
  expect(academyAdminAckIsVerified('other',201,{code:'ACADEMY_PACKAGE_SAVED'},{})).toBe(false);
 });
});

describe('admin academy denied-session mutation fencing #315',()=>{
 it('requires a fresh signed staff snapshot before new or same-operation retry POSTs',()=>{
  expect(academyAdminCanSend('ready',true,false)).toBe(true);
  for(const phase of ['loading','error','denied'] as const){
   expect(academyAdminCanSend(phase,true,false)).toBe(false);
  }
  expect(academyAdminCanSend('ready',false,false)).toBe(false);
  expect(academyAdminCanSend('ready',true,true)).toBe(false);
  expect(academyAdminCanSend('denied',false,true)).toBe(false);
 });
 it('discards late successful invite/activation receipts after staff revocation',()=>{
  const signed={user:{id:'synthetic-staff'},session:'synthetic-session'};
  expect(academyAdminMutationMayApply(signed,signed,false)).toBe(true);
  // Same authenticated object is not sufficient after an authoritative 403.
  expect(academyAdminMutationMayApply(signed,signed,true)).toBe(false);
  expect(academyAdminMutationMayApply(signed,{...signed},false)).toBe(false);
  expect(academyAdminMutationMayApply(signed,{...signed},true)).toBe(false);
 });
});
