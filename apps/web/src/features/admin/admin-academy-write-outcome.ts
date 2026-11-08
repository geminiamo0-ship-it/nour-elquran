/** #315: Treat unknown staff D1 write outcomes as unresolved financial commands.
 * Only reviewed terminal business conflicts release the original operationId.
 */
const terminalConflicts=new Set([
 'ACADEMY_REQUEST_MISMATCH','ACADEMY_PACKAGE_VERSION_UNAVAILABLE',
 'ACADEMY_CYCLE_OVERLAP','ACADEMY_RENEWAL_CONFLICT',
 'ACADEMY_ROLLOVER_CONFLICT','ACADEMY_REQUEST_ALREADY_ACTIVATED',
 'ACADEMY_REQUEST_REJECTED','ACADEMY_REQUEST_NOT_FOUND',
 'ACADEMY_OPERATION_CONFLICT','ACADEMY_PACKAGE_UNAVAILABLE',
 'ACADEMY_LEARNER_UNAVAILABLE','ACADEMY_REFERENCE_UNAVAILABLE',
 'ACADEMY_STAFF_ACCESS_CHANGED','ACADEMY_INVITE_ALREADY_ISSUED',
]);
export function academyAdminOutcomeIsUncertain(status:number,code=''){
 if(status===409)return !terminalConflicts.has(code);
 return status===408||status===425||status===429||status>=500;
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
