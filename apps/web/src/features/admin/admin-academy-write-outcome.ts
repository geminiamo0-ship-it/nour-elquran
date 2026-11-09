/** #315: Treat unknown staff D1 write outcomes as unresolved financial commands.
 * Only reviewed terminal business conflicts release the original operationId.
 */
// A 4xx body is terminal only when the SAME Worker command can emit it.
// Accepting an activation-only 409 on an invitation POST could discard the
// invitation's immutable operationId after an intermediary replaced its ACK.
const terminalConflictsByPath:Readonly<Record<string,ReadonlySet<string>>>={
 packages:new Set(['ACADEMY_OPERATION_CONFLICT']),
 activate:new Set([
  'ACADEMY_OPERATION_CONFLICT','ACADEMY_REQUEST_MISMATCH',
  'ACADEMY_PACKAGE_VERSION_UNAVAILABLE','ACADEMY_CYCLE_OVERLAP',
  'ACADEMY_RENEWAL_CONFLICT','ACADEMY_ROLLOVER_CONFLICT',
  'ACADEMY_REQUEST_ALREADY_ACTIVATED','ACADEMY_REQUEST_REJECTED',
  'ACADEMY_REQUEST_NOT_FOUND','ACADEMY_PACKAGE_UNAVAILABLE',
  'ACADEMY_LEARNER_UNAVAILABLE','ACADEMY_REFERENCE_UNAVAILABLE',
  'ACADEMY_STAFF_ACCESS_CHANGED',
 ]),
 reject:new Set(['ACADEMY_OPERATION_CONFLICT']),
 contact:new Set(['ACADEMY_OPERATION_CONFLICT']),
 invites:new Set(['ACADEMY_INVITE_ALREADY_ISSUED']),
};
const invalidByPath:Readonly<Record<string,string>>={
 packages:'ACADEMY_INVALID_PACKAGE',
 activate:'ACADEMY_INVALID_ACTIVATION',
 reject:'ACADEMY_INVALID_REJECTION',
 contact:'ACADEMY_INVALID_CONTACT',
 invites:'ACADEMY_INVALID_INVITE',
};
// A gateway can replace a committed D1 ACK with a plausible 401/403/404/405
// (including a valid-looking Worker error code). None of these HTTP responses
// proves that the original immutable operation did not commit.
export function academyAdminOutcomeIsUncertain(
 path:string,status:number,code='',exactCodeOnly=true){
 if(!exactCodeOnly)return true;
 // An intermediary may replace an already-committed D1 write with a
 // perfectly shaped 403 {code:'STAFF_ACCESS_DENIED'}. The browser cannot
 // authenticate that denial, so retain the immutable operationId for an
 // explicit same-ID replay after a fresh signed staff authorization check.
 if(status===401||status===403||status===404||status===405)return true;
 if(status===409)return !terminalConflictsByPath[path]?.has(code);
 if(status===400)return invalidByPath[path]!==code;
 return true;
}
/** A proxy's 2xx is not evidence that the expected D1 command committed. */
export function academyAdminAckIsVerified(path:string,status:number,raw:unknown,command:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 const v=raw as Record<string,unknown>;
 const codes:Record<string,readonly [string,string?]>={
  packages:['ACADEMY_PACKAGE_SAVED','ACADEMY_PACKAGE_REPLAY'],
  activate:['ACADEMY_SUBSCRIPTION_ACTIVATED','ACADEMY_ACTIVATION_REPLAY'],
  reject:['ACADEMY_REQUEST_REJECTED','ACADEMY_REQUEST_REJECTION_REPLAY'],
  contact:['ACADEMY_WHATSAPP_SAVED','ACADEMY_CONTACT_REPLAY'],
  invites:['ACADEMY_INVITE_ISSUED'],
 };
 const expected=codes[path];
 if(!expected||!((status===201&&v.code===expected[0])||
  (status===200&&v.code===expected[1]&&expected[1]!==undefined)))return false;
 // The Worker emits a fixed response shape per command/status. A proxy or
 // stale handler must not attach extra fields (including payment assertions)
 // and still unlock a new financial operation or reveal an invite token.
 const fields:Readonly<Record<string,readonly string[]>>={
  packages:['code','packageId'],
  activate:status===201?['code','startsAtMs','endsAtMs','rolloverSessions']:['code'],
  reject:['code'],
  contact:['code'],
  invites:['code','token','expiresAtMs'],
 };
 const required=fields[path];
 if(!required||Object.keys(v).length!==required.length||
  !required.every(k=>Object.prototype.hasOwnProperty.call(v,k)))return false;
 if(path==='packages'){
  if(!command||typeof command!=='object'||Array.isArray(command))return false;
  const packageId=(command as Record<string,unknown>).packageId;
  if(typeof packageId!=='string'||v.packageId!==packageId)return false;
 }
 if(path==='activate'&&status===201){
  if(!Number.isSafeInteger(v.startsAtMs)||!Number.isSafeInteger(v.endsAtMs)||
   typeof v.startsAtMs!=='number'||typeof v.endsAtMs!=='number'||
   v.startsAtMs<0||v.endsAtMs<=v.startsAtMs||
   v.endsAtMs>8_640_000_000_000_000||
   !Number.isSafeInteger(v.rolloverSessions)||typeof v.rolloverSessions!=='number'||
   v.rolloverSessions<0||v.rolloverSessions>60)return false;
 }
 if(path==='invites'){
  const now=Date.now();
  return status===201&&typeof v.token==='string'&&
   /^[0-9a-f]{64}$/.test(v.token)&&typeof v.expiresAtMs==='number'&&
   Number.isSafeInteger(v.expiresAtMs)&&v.expiresAtMs>now&&
   v.expiresAtMs<=8_640_000_000_000_000&&
   v.expiresAtMs<=now+7*86400000+5*60000;
 }
 return true;
}

/** A pending staff write may be replayed only after a fresh authorized
 * D1 read. A 403/failed refresh leaves the original operation intact but
 * must not display a clickable retry that silently does nothing. */
export function academyAdminCanReplay(
 hasSignedSnapshot:boolean,revoked:boolean,inFlight:boolean):boolean{
 return hasSignedSnapshot&&!revoked&&!inFlight;
}

/** A confirmation belongs to the exact Admin section where it was checked.
 * Next route/mode may reuse the same mounted component and form state.
 * Never let a previous section's consent authorize a different D1 command. */
/** A stale request from another signed actor must not lock this actor's
 * Admin panel. Keep the attempt identity so an old finally block cannot
 * release a newer actor's in-flight command. The shared pending store still
 * enforces exact-operation replay for the same actor. */
export type AcademySessionAttempt<T>={session:T;attempt:object};
export function academyAdminSessionLockIsBusy<T>(
 inFlight:AcademySessionAttempt<T>|null,session:T):boolean{
 return inFlight!==null&&inFlight.session===session;
}
export function academyAdminReleaseSessionLock<T>(
 inFlight:AcademySessionAttempt<T>|null,attempt:object
):AcademySessionAttempt<T>|null{
 return inFlight?.attempt===attempt?null:inFlight;
}

export function academyAdminConfirmationMatchesMode(
 confirmed:boolean,confirmedMode:string|null,currentMode:string):boolean{
 return confirmed&&confirmedMode===currentMode;
}

/** After a confirmed D1 decision, the old request selection is no longer
 * actionable. Never clear it for an uncertain write: the original operation
 * and its payload must remain available for exact-ID reconciliation. */
export function academyAdminAckClearsRequestSelection(path:string):boolean{
 return path==='activate'||path==='reject';
}

/** A reject button bypasses native form validation. Do not POST unless the
 * selected signed D1 request is pending and the audit reason is valid. */
export function academyAdminCanReject(
 requests:ReadonlyArray<{id:string;state:string}>,
 requestId:string,reason:string,confirmed:boolean,busy:boolean):boolean{
 const note=reason.trim();
 return confirmed&&!busy&&note.length>=10&&note.length<=500&&
  requests.some(r=>r.id===requestId&&r.state==='pending');
}
