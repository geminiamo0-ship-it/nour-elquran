/** #315: Signed simple academy operations, Cloudflare D1 only.
 * No payment gateway exists: a staff attestation is NOT a provider receipt.
 */
import type {CoreDatabase} from './bindings.ts';
import {canManageTeachers} from './staff-teachers.ts';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:readonly string[])=>
 Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&UUID.test(v);
const validNote=(v:unknown,min=8)=>typeof v==='string'&&v.trim()===v&&v.length>=min&&v.length<=500;
const validTitle=(v:unknown)=>typeof v==='string'&&v.trim()===v&&v.length>=2&&v.length<=80;
const validPrice=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=1&&Number(v)<=100000;
const allowed=(e:unknown)=>e instanceof Error&&/constraint|abort|ACADEMY_|SUBSCRIPTION_|UNIQUE|FOREIGN KEY/i.test(e.message);
type PackageRow={id:string;packageId:string;title:string;priceEgp:number;sessions:number;active:number;atMs:number};
const currentPackages=`SELECT p.id,p.package_id AS packageId,p.title,p.price_egp AS priceEgp,
 p.sessions,p.active,p.at_ms AS atMs FROM academy_package_events p
 WHERE NOT EXISTS(SELECT 1 FROM academy_package_events newer
  WHERE newer.package_id=p.package_id AND
   (newer.at_ms>p.at_ms OR (newer.at_ms=p.at_ms AND newer.id>p.id)))
 ORDER BY p.at_ms DESC,p.id DESC LIMIT 100`;
async function currentPackage(db:CoreDatabase,packageId:string){
 return db.prepare(`SELECT p.id,p.package_id AS packageId,p.title,p.price_egp AS priceEgp,
 p.sessions,p.active,p.at_ms AS atMs FROM academy_package_events p
 WHERE p.package_id=? AND NOT EXISTS(SELECT 1 FROM academy_package_events newer
 WHERE newer.package_id=p.package_id AND (newer.at_ms>p.at_ms OR
 (newer.at_ms=p.at_ms AND newer.id>p.id))) LIMIT 1`)
 .bind(packageId).first<PackageRow>();
}
async function verifiedOwner(db:CoreDatabase,subject:string,learnerId:string){
 if(!ID.test(learnerId))return false;
 const r=await db.prepare(`SELECT 1 AS ok FROM learners l JOIN accounts a
 ON a.id=l.account_id WHERE l.id=? AND a.auth_subject=?
 AND l.status='active' AND a.status='active'`).bind(learnerId,subject).first<{ok:number}>();
 return r?.ok===1;
}
async function contact(db:CoreDatabase){
 const r=await db.prepare(`SELECT whatsapp_number AS number FROM academy_contact_events
 ORDER BY at_ms DESC,id DESC LIMIT 1`).first<{number:string}>();
 return r?.number??null;
}
export async function ownerAcademy(db:CoreDatabase,subject:string,learnerId:string){
 if(!await verifiedOwner(db,subject,learnerId))return {status:404,code:'NOT_FOUND'} as const;
 const [p,r,w]=await Promise.all([
 db.prepare(currentPackages).all<PackageRow>(),
 db.prepare(`SELECT req.id,req.package_version_id AS packageVersionId,
  pkg.title,pkg.price_egp AS priceEgp,pkg.sessions,req.at_ms AS atMs,
  CASE WHEN a.id IS NOT NULL THEN 'activated'
       WHEN rej.id IS NOT NULL THEN 'rejected' ELSE 'pending' END AS state
  FROM academy_request_events req
  JOIN academy_package_events pkg ON pkg.id=req.package_version_id
  LEFT JOIN academy_subscription_activation_events a ON a.request_id=req.id
  LEFT JOIN academy_request_rejections rej ON rej.request_id=req.id
  WHERE req.learner_id=? ORDER BY req.at_ms DESC,req.id DESC LIMIT 30`)
 .bind(learnerId).all<Record<string,unknown>>(),contact(db)]);
 return {status:200,code:'ACADEMY_OWNER',packages:p.results.filter(x=>x.active===1)
  .map(({id,packageId,title,priceEgp,sessions})=>
   ({versionId:id,packageId,title,priceEgp,sessions})),
  requests:r.results,whatsappNumber:w} as const;
}
export async function ownerPackageRequest(db:CoreDatabase,subject:string,
 learnerId:string,raw:unknown,now=Date.now()){
 if(!object(raw)||!exact(raw,['operationId','packageId'])||
  !uuid(raw.operationId)||!uuid(raw.packageId))
  return {status:400,code:'ACADEMY_INVALID_REQUEST'} as const;
 if(!await verifiedOwner(db,subject,learnerId))
  return {status:404,code:'NOT_FOUND'} as const;
 const prior=await db.prepare(`SELECT id,learner_id AS learnerId,actor_subject AS actor,
 package_id AS packageId FROM academy_request_events WHERE operation_id=?`)
 .bind(raw.operationId).first<{id:string;learnerId:string;actor:string;packageId:string}>();
 if(prior)return prior.actor===subject&&prior.learnerId===learnerId&&
  prior.packageId===raw.packageId?
  {status:200,code:'ACADEMY_REQUEST_REPLAY',academyRequestId:prior.id} as const:
  {status:409,code:'ACADEMY_OPERATION_CONFLICT'} as const;
 const pkg=await currentPackage(db,raw.packageId);
 if(!pkg||pkg.active!==1)return {status:409,code:'ACADEMY_PACKAGE_UNAVAILABLE'} as const;
 const id=crypto.randomUUID();
 try{
  await db.prepare(`INSERT INTO academy_request_events
   (id,operation_id,learner_id,actor_subject,package_id,package_version_id,kind,at_ms)
   VALUES(?,?,?,?,?,?,'subscription',?)`)
  .bind(id,raw.operationId,learnerId,subject,pkg.packageId,pkg.id,now).run();
 }catch(e){
  if(allowed(e))return {status:409,code:'ACADEMY_REQUEST_DENIED'} as const;
  throw e;
 }
 return {status:201,code:'ACADEMY_REQUEST_CREATED',academyRequestId:id} as const;
}
export async function staffAcademy(db:CoreDatabase,subject:string){
 if(!await canManageTeachers(db,subject))
  return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 const [p,r,i,w]=await Promise.all([
  db.prepare(currentPackages).all<PackageRow>(),
  db.prepare(`SELECT req.id,req.learner_id AS learnerId,l.display_name AS learnerName,
   p.title,p.price_egp AS priceEgp,p.sessions,
   req.package_version_id AS packageVersionId,req.at_ms AS atMs,
   CASE WHEN a.id IS NOT NULL THEN 'activated'
        WHEN rej.id IS NOT NULL THEN 'rejected' ELSE 'pending' END AS state
   FROM academy_request_events req JOIN learners l ON l.id=req.learner_id
   JOIN academy_package_events p ON p.id=req.package_version_id
   LEFT JOIN academy_subscription_activation_events a ON a.request_id=req.id
   LEFT JOIN academy_request_rejections rej ON rej.request_id=req.id
   ORDER BY req.at_ms DESC,req.id DESC LIMIT 100`).all<Record<string,unknown>>(),
  db.prepare(`SELECT inv.id,inv.created_at_ms AS createdAtMs,inv.expires_at_ms AS expiresAtMs,
   inv.claimed_at_ms AS claimedAtMs,u.name AS teacherName,
   inv.claimed_subject AS claimedSubject, t.id AS teacherId
   FROM academy_teacher_invites inv
   LEFT JOIN auth_users u ON u.id=inv.claimed_subject
   LEFT JOIN teachers t ON t.auth_subject=inv.claimed_subject
   ORDER BY inv.created_at_ms DESC,inv.id DESC LIMIT 50`).all<Record<string,unknown>>(),
  contact(db),
 ]);
 return {status:200,code:'ACADEMY_STAFF',packages:p.results,requests:r.results,
  invites:i.results,whatsappNumber:w} as const;
}
export async function staffPackage(db:CoreDatabase,subject:string,raw:unknown,now=Date.now()){
 if(!object(raw)||!exact(raw,['operationId','packageId','title','priceEgp','sessions','active'])||
 !uuid(raw.operationId)||!uuid(raw.packageId)||!validTitle(raw.title)||
 !validPrice(raw.priceEgp)||!Number.isSafeInteger(raw.sessions)||
 Number(raw.sessions)<1||Number(raw.sessions)>60||typeof raw.active!=='boolean')
  return {status:400,code:'ACADEMY_INVALID_PACKAGE'} as const;
 if(!await canManageTeachers(db,subject))return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 const prior=await db.prepare(`SELECT id,package_id AS packageId,actor_subject AS actor,
 title,price_egp AS priceEgp,sessions,active FROM academy_package_events
 WHERE operation_id=?`).bind(raw.operationId).first<PackageRow&{actor:string}>();
 if(prior)return prior.actor===subject&&prior.packageId===raw.packageId&&
 prior.title===raw.title&&prior.priceEgp===raw.priceEgp&&prior.sessions===raw.sessions&&
 prior.active===(raw.active?1:0)?
  {status:200,code:'ACADEMY_PACKAGE_REPLAY',packageId:prior.packageId} as const:
  {status:409,code:'ACADEMY_OPERATION_CONFLICT'} as const;
 const last=await currentPackage(db,raw.packageId);
 const at=Math.max(now,(last?.atMs??0)+1);
 const id=crypto.randomUUID();
 try{await db.prepare(`INSERT INTO academy_package_events
  (id,operation_id,package_id,actor_subject,title,price_egp,sessions,active,at_ms)
  VALUES(?,?,?,?,?,?,?,?,?)`)
 .bind(id,raw.operationId,raw.packageId,subject,raw.title,raw.priceEgp,
 raw.sessions,raw.active?1:0,at).run();}
 catch(e){if(allowed(e))return {status:409,code:'ACADEMY_PACKAGE_DENIED'} as const;throw e;}
 return {status:201,code:'ACADEMY_PACKAGE_SAVED',packageId:raw.packageId} as const;
}
// One month of wall-clock time in Africa/Cairo, including DST transitions.
// Return a Date at the identical local clock on the same day next month (or
// the final day when the following month is shorter).
const cairoParts=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',
 year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',
 minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function parts(at:number){
 const p=Object.fromEntries(cairoParts.formatToParts(new Date(at))
 .filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));
 return p as Record<'year'|'month'|'day'|'hour'|'minute'|'second',number>;
}
export function cairoMonthEnd(start:number){
 const p=parts(start), next=new Date(Date.UTC(p.year,p.month,1));
 const year=next.getUTCFullYear(),month=next.getUTCMonth()+1;
 const day=Math.min(p.day,new Date(Date.UTC(year,month,0)).getUTCDate());
 const target=Date.UTC(year,month-1,day,p.hour,p.minute,p.second)+start%1000;
 let guess=target-2*3600000;
 for(let n=0;n<4;n++){
  const x=parts(guess);
  const display=Date.UTC(x.year,x.month-1,x.day,x.hour,x.minute,x.second)+guess%1000;
  const delta=target-display;if(delta===0)break;guess+=delta;
 }
 return guess;
}
export async function staffActivate(db:CoreDatabase,subject:string,raw:unknown,now=Date.now()){
 if(!object(raw)||!exact(raw,['operationId','learnerId','packageVersionId','requestId','note','manualConfirmed'])||
 !uuid(raw.operationId)||!uuid(raw.learnerId)||!uuid(raw.packageVersionId)||
 !(raw.requestId===null||uuid(raw.requestId))||!validNote(raw.note,10)||
 raw.manualConfirmed!==true)
 return {status:400,code:'ACADEMY_INVALID_ACTIVATION'} as const;
 if(!await canManageTeachers(db,subject))return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 const previous=await db.prepare(`SELECT id,actor_subject AS actor,learner_id AS learnerId,
 package_version_id AS packageVersionId,request_id AS requestId
 FROM academy_subscription_activation_events WHERE operation_id=?`)
 .bind(raw.operationId).first<{id:string;actor:string;learnerId:string;
 packageVersionId:string;requestId:string|null}>();
 if(previous)return previous.actor===subject&&previous.learnerId===raw.learnerId&&
 previous.packageVersionId===raw.packageVersionId&&previous.requestId===raw.requestId?
 {status:200,code:'ACADEMY_ACTIVATION_REPLAY'} as const:
 {status:409,code:'ACADEMY_OPERATION_CONFLICT'} as const;
 const last=await db.prepare(`SELECT id,ends_at_ms AS endsAtMs,
 base_sessions AS baseSessions,rollover_sessions AS rolloverSessions,
 (SELECT COUNT(*) FROM subscription_spend_events spend
  WHERE spend.source_kind='cycle' AND spend.source_id=c.id) AS spent
 FROM subscription_cycles c WHERE learner_id=? ORDER BY starts_at_ms DESC,id DESC LIMIT 1`)
 .bind(raw.learnerId).first<{id:string;endsAtMs:number;baseSessions:number;
 rolloverSessions:number;spent:number}>();
 const start=Math.max(now,last?.endsAtMs??now);
 const ends=cairoMonthEnd(start);
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(ends)||ends<=start)
  return {status:503,code:'ACADEMY_CLOCK_UNAVAILABLE'} as const;
 const carry=last&&start<=last.endsAtMs+259200000?
 Math.min(last.baseSessions,Math.max(0,last.baseSessions+last.rolloverSessions-last.spent)):0;
 try{
 await db.prepare(`INSERT INTO academy_subscription_activation_events
 (id,operation_id,actor_subject,learner_id,request_id,package_version_id,cycle_id,
 previous_cycle_id,rollover_sessions,starts_at_ms,ends_at_ms,note,manually_confirmed,at_ms)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1,?)`).bind(crypto.randomUUID(),raw.operationId,subject,
 raw.learnerId,raw.requestId,raw.packageVersionId,crypto.randomUUID(),
 last?.id??null,carry,start,ends,raw.note,start).run();
 }catch(e){if(allowed(e))return {status:409,code:'ACADEMY_ACTIVATION_DENIED'} as const;throw e;}
 return {status:201,code:'ACADEMY_SUBSCRIPTION_ACTIVATED',startsAtMs:start,
 endsAtMs:ends,rolloverSessions:carry} as const;
}
export async function staffReject(db:CoreDatabase,subject:string,raw:unknown,now=Date.now()){
 if(!object(raw)||!exact(raw,['operationId','requestId','reason'])||
 !uuid(raw.operationId)||!uuid(raw.requestId)||!validNote(raw.reason))
 return {status:400,code:'ACADEMY_INVALID_REJECTION'} as const;
 if(!await canManageTeachers(db,subject))return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 try{await db.prepare(`INSERT INTO academy_request_rejections
  (id,operation_id,request_id,actor_subject,reason,at_ms) VALUES(?,?,?,?,?,?)`)
 .bind(crypto.randomUUID(),raw.operationId,raw.requestId,subject,raw.reason,now).run();}
 catch(e){if(allowed(e))return {status:409,code:'ACADEMY_REQUEST_REJECTION_DENIED'} as const;throw e;}
 return {status:201,code:'ACADEMY_REQUEST_REJECTED'} as const;
}
export async function staffContact(db:CoreDatabase,subject:string,raw:unknown,now=Date.now()){
 if(!object(raw)||!exact(raw,['operationId','whatsappNumber'])||
 !uuid(raw.operationId)||typeof raw.whatsappNumber!=='string'||
 !/^[1-9][0-9]{9,14}$/.test(raw.whatsappNumber))
 return {status:400,code:'ACADEMY_INVALID_CONTACT'} as const;
 if(!await canManageTeachers(db,subject))return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 try{await db.prepare(`INSERT INTO academy_contact_events
 (id,operation_id,actor_subject,whatsapp_number,at_ms) VALUES(?,?,?,?,?)`)
 .bind(crypto.randomUUID(),raw.operationId,subject,raw.whatsappNumber,now).run();}
 catch(e){if(allowed(e))return {status:409,code:'ACADEMY_CONTACT_DENIED'} as const;throw e;}
 return {status:201,code:'ACADEMY_WHATSAPP_SAVED'} as const;
}
function hex(bytes:Uint8Array){return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function digest(token:string){
 return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))));
}
export async function staffInvite(db:CoreDatabase,subject:string,raw:unknown,now=Date.now()){
 if(!object(raw)||!exact(raw,['operationId'])||!uuid(raw.operationId))
 return {status:400,code:'ACADEMY_INVALID_INVITE'} as const;
 if(!await canManageTeachers(db,subject))return {status:403,code:'STAFF_ACCESS_DENIED'} as const;
 // Do not reveal the one-time secret on idempotent replay: server stores hash only.
 const prior=await db.prepare('SELECT id FROM academy_teacher_invites WHERE operation_id=?')
 .bind(raw.operationId).first<{id:string}>();
 if(prior)return {status:409,code:'ACADEMY_INVITE_ALREADY_ISSUED'} as const;
 const token=hex(crypto.getRandomValues(new Uint8Array(32)));
 const tokenHash=await digest(token);
 try{await db.prepare(`INSERT INTO academy_teacher_invites
  (id,operation_id,token_hash,actor_subject,created_at_ms,expires_at_ms)
  VALUES(?,?,?,?,?,?)`).bind(crypto.randomUUID(),raw.operationId,tokenHash,
   subject,now,now+7*86400000).run();}
 catch(e){if(allowed(e))return {status:409,code:'ACADEMY_INVITE_DENIED'} as const;throw e;}
 return {status:201,code:'ACADEMY_INVITE_ISSUED',token,expiresAtMs:now+7*86400000} as const;
}
export async function claimInvite(db:CoreDatabase,subject:string,raw:unknown,now=Date.now()){
 if(!object(raw)||!exact(raw,['token'])||typeof raw.token!=='string'||
 !/^[0-9a-f]{64}$/.test(raw.token)||!ID.test(subject))
 return {status:400,code:'ACADEMY_INVALID_INVITE'} as const;
 const hash=await digest(raw.token);
 const current=await db.prepare(`SELECT id,claimed_subject AS claimedSubject,expires_at_ms AS expiresAtMs
 FROM academy_teacher_invites WHERE token_hash=?`).bind(hash)
 .first<{id:string;claimedSubject:string|null;expiresAtMs:number}>();
 if(!current||current.expiresAtMs<now)return {status:404,code:'ACADEMY_INVITE_NOT_FOUND'} as const;
 if(current.claimedSubject===subject)return {status:200,code:'ACADEMY_INVITE_CLAIMED'} as const;
 if(current.claimedSubject)return {status:409,code:'ACADEMY_INVITE_USED'} as const;
 try{
 const response=await db.prepare(`UPDATE academy_teacher_invites SET claimed_subject=?,claimed_at_ms=?
 WHERE id=? AND claimed_subject IS NULL AND expires_at_ms>=?`)
 .bind(subject,now,current.id,now).run();
 if(response.meta.changes!==1)return {status:409,code:'ACADEMY_INVITE_USED'} as const;
 }catch(e){if(allowed(e))return {status:409,code:'ACADEMY_INVITE_DENIED'} as const;throw e;}
 return {status:201,code:'ACADEMY_INVITE_CLAIMED'} as const;
}
