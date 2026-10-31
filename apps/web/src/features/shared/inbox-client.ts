export type InboxNotice=Readonly<{
 id:string;learnerId:string;kind:string;sourceId:string;
 title:string;detail:string;createdAtMs:number;read:boolean;revision:number;
}>;
export class InboxError extends Error{
 constructor(readonly code:string,readonly status:number=0){super(code);}
}
const isObject=(x:unknown):x is Record<string,unknown>=>
 !!x&&typeof x==='object'&&!Array.isArray(x);
const hex=/^[0-9a-f]{32}$/;
export function parseInboxItems(raw:unknown):readonly InboxNotice[]{
 if(!Array.isArray(raw)||raw.length>100)throw new InboxError('INVALID_INBOX_RESPONSE');
 return raw.map(item=>{
  if(!isObject(item)||!hex.test(String(item.id))||
   typeof item.learnerId!=='string'||!/^[A-Za-z0-9-]{1,128}$/.test(item.learnerId)||
   !['assignment_published','lesson_booked','lesson_rescheduled','lesson_cancelled','lesson_completed'].includes(String(item.kind))||
   typeof item.sourceId!=='string'||typeof item.title!=='string'||item.title.length>80||
   typeof item.detail!=='string'||item.detail.length>240||
   !Number.isSafeInteger(item.createdAtMs)||Number(item.createdAtMs)<0||
   typeof item.read!=='boolean'||!Number.isSafeInteger(item.revision)||Number(item.revision)<0)
   throw new InboxError('INVALID_INBOX_RESPONSE');
  return item as InboxNotice;
 });
}
async function request(url:string,body?:unknown,signal?:AbortSignal){
 let res:Response;
 try{res=await fetch(url,{credentials:'same-origin',cache:'no-store',redirect:'error',
  method:body===undefined?'GET':'POST',
  ...(body===undefined?{}:{headers:{'content-type':'application/json'},
   body:JSON.stringify(body)}),...(signal?{signal}:{})});}
 catch{throw new InboxError('NETWORK_UNAVAILABLE');}
 let value:unknown;
 try{value=await res.json();}catch{throw new InboxError('INVALID_INBOX_RESPONSE',res.status);}
 if(!isObject(value))throw new InboxError('INVALID_INBOX_RESPONSE',res.status);
 if(!res.ok)throw new InboxError(typeof value.code==='string'?value.code:'INBOX_UNAVAILABLE',res.status);
 return value;
}
export function inboxClient(){
 return {
  teacher:async(signal?:AbortSignal)=>{
   const response=await request('/v1/teacher/inbox',undefined,signal);
   if(response.code!=='INBOX')throw new InboxError('INVALID_INBOX_RESPONSE');
   return parseInboxItems(response.items);
  },
  owner:async(learnerId:string,signal?:AbortSignal)=>{
   if(!/^[A-Za-z0-9-]{1,128}$/.test(learnerId))throw new InboxError('INVALID_LEARNER');
   const response=await request('/v1/me/learners/'+encodeURIComponent(learnerId)+'/inbox',undefined,signal);
   if(response.code!=='INBOX')throw new InboxError('INVALID_INBOX_RESPONSE');
   return parseInboxItems(response.items);
  },
  mark:async(role:'teacher'|'owner',learnerId:string|null,item:InboxNotice,read:boolean,operationId:string)=>{
   if(!hex.test(item.id)||!/^[0-9a-f-]{36}$/i.test(operationId))
    throw new InboxError('INVALID_INBOX_ACTION');
   if(role==='owner'&&(!learnerId||!/^[A-Za-z0-9-]{1,128}$/.test(learnerId)))
    throw new InboxError('INVALID_LEARNER');
   const url=role==='teacher'?'/v1/teacher/inbox-actions':
    '/v1/me/learners/'+encodeURIComponent(learnerId!)+'/inbox-actions';
   const value=await request(url,{notificationId:item.id,
    operationId,action:read?'read':'unread',expectedRevision:item.revision});
   if(!['INBOX_UPDATED','INBOX_ALREADY_UPDATED'].includes(String(value.code))||
    !Number.isSafeInteger(value.revision)||value.revision!==item.revision+1||
    value.read!==read)throw new InboxError('INVALID_INBOX_RESPONSE');
   return {...item,read,revision:value.revision} as InboxNotice;
  }
 };
}
