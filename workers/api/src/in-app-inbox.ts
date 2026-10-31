import type {CoreDatabase} from './bindings.ts';

export type InboxRole='owner'|'teacher';
export type InboxNotice=Readonly<{
 id:string;learnerId:string;kind:string;sourceId:string;
 title:string;detail:string;createdAtMs:number;read:boolean;revision:number;
}>;
export type InboxAction=Readonly<{
 notificationId:string;operationId:string;action:'read'|'unread';expectedRevision:number;
}>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hex32=/^[0-9a-f]{32}$/;
const learnerPattern=/^[A-Za-z0-9-]{1,128}$/;
export function parseInboxAction(raw:unknown):InboxAction|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const x=raw as Record<string,unknown>;
 if(Object.keys(x).length!==4||
  !['notificationId','operationId','action','expectedRevision'].every(k=>Object.hasOwn(x,k))||
  typeof x.notificationId!=='string'||!hex32.test(x.notificationId)||
  typeof x.operationId!=='string'||!uuid.test(x.operationId)||
  (x.action!=='read'&&x.action!=='unread')||
  !Number.isSafeInteger(x.expectedRevision)||Number(x.expectedRevision)<0)
  return null;
 return x as InboxAction;
}
async function authorized(db:CoreDatabase,subject:string,role:InboxRole,
 learnerId:string|null):Promise<boolean>{
 if(!subject||subject.length>128)return false;
 if(role==='teacher'){
  const t=await db.prepare(`SELECT 1 AS allowed FROM teachers t
   JOIN auth_users u ON u.id=t.auth_subject
   WHERE t.auth_subject=? AND t.qualified=1 AND t.status='active' LIMIT 1`)
   .bind(subject).first<{allowed:number}>();
  return t?.allowed===1;
 }
 if(!learnerId||!learnerPattern.test(learnerId))return false;
 const own=await db.prepare(`SELECT 1 AS allowed FROM learners l
 JOIN accounts a ON a.id=l.account_id
 WHERE l.id=? AND l.status='active' AND a.status='active'
 AND a.auth_subject=? LIMIT 1`).bind(learnerId,subject).first<{allowed:number}>();
 return own?.allowed===1;
}
type Row={
 id:string;learner_id:string;kind:string;source_id:string;title:string;
 detail:string;created_at_ms:number;action:string|null;revision:number;
};
const listSql=`SELECT n.id,n.learner_id,n.kind,n.source_id,n.title,n.detail,n.created_at_ms,
 COALESCE((SELECT e.action FROM noor_inbox_read_events e
  WHERE e.notification_id=n.id ORDER BY e.revision DESC LIMIT 1),'unread') AS action,
 COALESCE((SELECT MAX(e.revision) FROM noor_inbox_read_events e
  WHERE e.notification_id=n.id),0) AS revision
 FROM noor_inbox_items n
 WHERE n.recipient_subject=? AND n.recipient_kind=?`;
function present(row:Row):InboxNotice{
 return {id:row.id,learnerId:row.learner_id,kind:row.kind,
  sourceId:row.source_id,title:row.title,detail:row.detail,
  createdAtMs:row.created_at_ms,read:row.action==='read',
  revision:row.revision};
}
export async function listInbox(db:CoreDatabase,subject:string,role:InboxRole,
 learnerId:string|null){
 if(!await authorized(db,subject,role,learnerId))
  return {status:role==='teacher'?403:404,code:'NOT_FOUND'} as const;
 const where=role==='owner'?' AND n.learner_id=?':'';
 const query=listSql+where+' ORDER BY n.created_at_ms DESC,n.id DESC LIMIT 100';
 const stmt=db.prepare(query);
 const rows=(await (role==='owner'?stmt.bind(subject,role,learnerId):
  stmt.bind(subject,role)).all<Row>()).results;
 return {status:200,code:'INBOX',items:rows.map(present)} as const;
}
type Prior={actor_subject:string;action:string;expected_revision:number;revision:number};
type Current={learner_id:string;recipient_subject:string;recipient_kind:InboxRole;
 action:string;revision:number};
export async function changeInboxRead(db:CoreDatabase,subject:string,role:InboxRole,
 learnerId:string|null,raw:unknown,now=Date.now()){
 const action=parseInboxAction(raw);
 if(!action)return {status:400,code:'INVALID_INBOX_ACTION'} as const;
 if(!await authorized(db,subject,role,learnerId))
  return {status:role==='teacher'?403:404,code:'NOT_FOUND'} as const;
 const notification=await db.prepare(`SELECT n.learner_id,n.recipient_subject,n.recipient_kind,
 COALESCE((SELECT e.action FROM noor_inbox_read_events e
  WHERE e.notification_id=n.id ORDER BY e.revision DESC LIMIT 1),'unread') AS action,
 COALESCE((SELECT MAX(e.revision) FROM noor_inbox_read_events e
  WHERE e.notification_id=n.id),0) AS revision
 FROM noor_inbox_items n WHERE n.id=? AND n.recipient_subject=?
 AND n.recipient_kind=?`)
  .bind(action.notificationId,subject,role).first<Current>();
 if(!notification||(role==='owner'&&notification.learner_id!==learnerId))
  return {status:404,code:'NOT_FOUND'} as const;
 const find=()=>db.prepare(`SELECT actor_subject,action,expected_revision,revision
 FROM noor_inbox_read_events WHERE notification_id=? AND operation_id=?`)
  .bind(action.notificationId,action.operationId).first<Prior>();
 const prior=await find();
 const replay=(row:Prior)=>{
  if(row.actor_subject!==subject||row.action!==action.action||
    row.expected_revision!==action.expectedRevision)
   return {status:409,code:'INBOX_OPERATION_CONFLICT'} as const;
  return {status:200,code:'INBOX_ALREADY_UPDATED',revision:row.revision,
   read:action.action==='read'} as const;
 };
 if(prior)return replay(prior);
 if(action.expectedRevision!==notification.revision)
  return {status:409,code:'INBOX_REVISION_CONFLICT'} as const;
 // Writing the same status twice is harmless: retain immutable read history.
 try{
  await db.prepare(`INSERT INTO noor_inbox_read_events(
   id,notification_id,operation_id,actor_subject,action,expected_revision,revision,at_ms)
   VALUES(?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),action.notificationId,
   action.operationId,subject,action.action,action.expectedRevision,
   action.expectedRevision+1,now).run();
 }catch(error){
  const raced=await find();
  if(raced)return replay(raced);
  if(error instanceof Error&&/constraint|INBOX_|UNIQUE/i.test(error.message))
   return {status:409,code:'INBOX_REVISION_CONFLICT'} as const;
  throw error;
 }
 return {status:200,code:'INBOX_UPDATED',revision:action.expectedRevision+1,
  read:action.action==='read'} as const;
}
