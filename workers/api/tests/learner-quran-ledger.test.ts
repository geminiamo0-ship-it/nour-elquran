import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseQuranLedgerCommand,appendQuranLedgerEvent,
 readOwnerCumulativePage,readTeacherSharedPage} from '../src/learner-quran-ledger.ts';
import type {CoreDatabase} from '../src/bindings.ts';

const command={operationId:'00000000-0000-4000-8000-000000000001',
 itemId:'annotation-001',action:'put' as const,kind:'pen' as const,
 originType:'self_study' as const,originId:null,page:1,surah:null,ayah:null,
 wordIndex:null,expectedRevision:0,
 payload:{color:'#abcdef',width:3,points:[{x:1,y:2},{x:3,y:4}]}};
test('canonical event parser rejects injected actor/learner, verse leaks and invalid shapes',()=>{
 assert.deepEqual(parseQuranLedgerCommand(command),command);
 for(const candidate of [
  {...command,actorSubject:'teacher-a'},
  {...command,learnerId:'another'},
  {...command,audience:'shared'},
  {...command,kind:'note',surah:null,ayah:null},
  {...command,kind:'note',surah:1,ayah:1,payload:{text:'ok'}},
  {...command,originType:'lesson',originId:null},
  {...command,originType:'self_study',originId:'l1'},
  {...command,wordIndex:1},
  {...command,page:605},
  {...command,expectedRevision:-1},
  {...command,action:'hide',expectedRevision:0,payload:{}},
  {...command,action:'hide',expectedRevision:1,payload:command.payload},
  {...command,payload:{color:'#abcdef',width:3,points:[{x:-1,y:2},{x:3,y:4}]}},
  {...command,payload:{color:'#abcdef',width:3,points:Array.from({length:2501},()=>({x:2,y:4}))}},
  {...command,payload:{color:'javascript:alert(1)',width:3,points:[{x:1,y:2},{x:3,y:4}]}}
 ])assert.equal(parseQuranLedgerCommand(candidate),null);
 assert.ok(parseQuranLedgerCommand({...command,itemId:'annotation-002',
  kind:'note',surah:1,ayah:1,payload:{color:'#abcdef',text:'ملاحظة الشيخ'}}));
});
test('service checks signed owner and rejects other learner before reading private stream',async()=>{
 const seen:Array<{sql:string;values:unknown[]}>= [];
 const db={prepare:(sql:string)=>({bind:(...values:unknown[])=>{
  seen.push({sql,values});
  return {first:async()=>null,all:async()=>({results:[]})};
 }})} as unknown as CoreDatabase;
 const response=await readOwnerCumulativePage(db,'owner-a','foreign',1);
 assert.deepEqual(response,{status:404,code:'NOT_FOUND'});
 assert.equal(seen.length,1);
 assert.deepEqual(seen[0]?.values,['foreign','owner-a']);
});
test('teacher read query never includes student-private store or private items',async()=>{
 const seen:Array<{sql:string;values:unknown[]}>= [];
 const db={prepare:(sql:string)=>({bind:(...values:unknown[])=>{
  seen.push({sql,values});
  return {first:async()=>({allowed:1}),
   all:async()=>({results:[]})};
 }})} as unknown as CoreDatabase;
 const response=await readTeacherSharedPage(db,'teacher-a','learner-a',1,1250);
 assert.equal(response.status,200);
 assert.ok('items' in response);
 if(!('items' in response))throw new Error('Expected authorized teacher read');
 assert.deepEqual(response.items,[]);
 assert.equal(seen.length,2);
 assert.ok(seen[1]?.sql.includes("audience='shared'"));
 assert.ok(!seen[1]?.sql.includes('private_mushaf'));
 assert.deepEqual(seen[1]?.values,['learner-a','hafs-kfqc:v1.1.1',1]);
});
test('new event writes trusted subject, role and authoritative edition only',async()=>{
 const seen:Array<{sql:string;values:unknown[]}>= [];
 const db={prepare:(sql:string)=>({bind:(...values:unknown[])=>{
  seen.push({sql,values});
  return {first:async()=>sql.includes('learner_quran_current')?
   {item_id:'annotation-001',page:1,kind:'pen',surah:null,ayah:null,
    word_index:null,visible:1,revision:1,audience:'private',author_role:'learner',
    author_subject:'owner-a',origin_type:'self_study',origin_id:null,
    payload_json:JSON.stringify(command.payload)}:
    sql.includes('SELECT 1 AS allowed')?{allowed:1}:null,
   run:async()=>({success:true,meta:{changes:1}})};
 }})} as unknown as CoreDatabase;
 const outcome=await appendQuranLedgerEvent(db,{subject:'owner-a',role:'learner'},
  'student-a',command,2500);
 assert.equal(outcome.status,201);
 assert.equal(outcome.item?.revision,1);
 const insert=seen.find(x=>x.sql.includes('INSERT INTO learner_quran_events'));
 assert.ok(insert);
 assert.deepEqual(insert.values.slice(1,10),[
  'student-a',command.operationId,command.itemId,'owner-a','learner',
  'self_study',null,'private','put'
 ]);
 assert.equal(insert.values[10],'hafs-kfqc:v1.1.1');
});
test('service does not treat a teacher self-study command as a granted edit',async()=>{
 const response=await appendQuranLedgerEvent({} as CoreDatabase,
  {subject:'teacher-a',role:'teacher'},'learner-a',command);
 assert.deepEqual(response,{status:404,code:'NOT_FOUND'});
});
test('D1 insert response lost after commit is an idempotent replay, never a new-write ACK',async()=>{
 for(const conflicting of [false,true]){
  let priorReads=0,insertAttempts=0;
  const prior={actor_subject:'owner-a',actor_role:'learner',action:'put',
   origin_type:'self_study',origin_id:null,item_id:command.itemId,
   kind:'pen',page:1,surah:null,ayah:null,word_index:null,
   expected_revision:0,payload_json:JSON.stringify(conflicting?
    {...command.payload,width:4}:command.payload)};
  const current={item_id:command.itemId,page:1,kind:'pen',
   surah:null,ayah:null,word_index:null,visible:1,revision:1,
   audience:'private',author_role:'learner',author_subject:'owner-a',
   origin_type:'self_study',origin_id:null,payload_json:prior.payload_json};
  const db={prepare:(sql:string)=>({
   bind(){return this;},
   async first(){
    if(sql.includes('SELECT 1 AS allowed'))return {allowed:1};
    if(sql.includes('FROM learner_quran_events'))
     return ++priorReads===1?null:prior;
    if(sql.includes('FROM learner_quran_current'))return current;
    return null;
   },
   async run(){
    insertAttempts++;
    // Simulate a concurrent insert committed by D1 before this request's
    // INSERT receives its UNIQUE-constraint response.
    throw Error('D1_ERROR: UNIQUE constraint failed');
   },
  })} as unknown as CoreDatabase;
  const result=await appendQuranLedgerEvent(db,
   {subject:'owner-a',role:'learner'},'student-a',command,2500);
  assert.deepEqual({status:result.status,code:result.code},
   conflicting?{status:409,code:'QURAN_EVENT_REJECTED'}:
    {status:200,code:'QURAN_EVENT_REPLAY'});
  assert.equal(insertAttempts,1);
  assert.equal(priorReads,2);
 }
});
