import test from 'node:test';
import assert from 'node:assert/strict';
import type {CoreDatabase} from '../src/bindings.ts';
import {ownerPaidSlotRequest,ownerPaidSlotRequests,
 staffPaidSlotRequests,staffPaidSlotDecision} from '../src/academy-paid-slot.ts';

const LEARNER='11111111-1111-4111-8111-111111111111';
const TEACHER='22222222-2222-4222-8222-222222222222';
const CYCLE='33333333-3333-4333-8333-333333333333';
const OP='44444444-4444-4444-8444-444444444444';
const REQUEST='55555555-5555-4555-8555-555555555555';
const NOW=100000000,START=NOW+120000;
type Query={sql:string;values:unknown[]};
function mock(opts:{owner?:boolean;staff?:boolean;prior?:Record<string,unknown>|null;
 rows?:Record<string,unknown>[];error?:Error}={}){
 const queries:Query[]=[];
 const db={
  prepare(sql:string){
   let values:unknown[]=[];
   const stmt={
    bind(...v:unknown[]){values=v;return stmt;},
    async first(){
     queries.push({sql,values});
     if(sql.includes('FROM learners l'))return opts.owner===false?null:{allowed:1};
     if(sql.includes('FROM staff_grants'))return opts.staff===false?null:{subject:'staff'};
     if(sql.includes('WHERE operation_id=?'))return opts.prior??null;
     return null;
    },
    async all(){queries.push({sql,values});return {results:opts.rows??[]};},
    async run(){queries.push({sql,values});if(opts.error)throw opts.error;
     return {success:true,meta:{changes:1}};},
   };
   return stmt;
  },
 } as unknown as CoreDatabase;
 return {db,queries};
}
const proposal={operationId:OP,teacherId:TEACHER,cycleId:CYCLE,startsAtMs:START};
const decision={operationId:OP,requestId:REQUEST,decision:'approved',reason:'Approved by academy staff'};

test('guardian request requires exact schema, owner and trusted server clock',async()=>{
 const x=mock();
 assert.equal((await ownerPaidSlotRequest(x.db,'owner',LEARNER,proposal,NOW)).status,201);
 const insert=x.queries.find(q=>q.sql.includes('INSERT INTO academy_paid_slot_request_events'));
 assert.ok(insert);
 assert.deepEqual(insert.values.slice(1),[OP,LEARNER,TEACHER,CYCLE,'owner',START,
  START+2400000,NOW]);
 for(const bad of [{...proposal,requestedAtMs:1},{...proposal,actorSubject:'staff'},
  {...proposal,startsAtMs:NOW-1},{...proposal,startsAtMs:'120000000'},
  {...proposal,startsAtMs:NOW+31*86400000}]){
  const m=mock();
  assert.equal((await ownerPaidSlotRequest(m.db,'owner',LEARNER,bad,NOW)).status,400);
  assert.equal(m.queries.length,0);
 }
 const denied=mock({owner:false});
 assert.deepEqual(await ownerPaidSlotRequest(denied.db,'owner',LEARNER,proposal,NOW),
  {status:404,code:'NOT_FOUND'});
 assert.equal(denied.queries.some(q=>q.sql.includes('INSERT INTO')),false);
});

test('guardian idempotency accepts only same owner, learner and immutable proposal',async()=>{
 const prior={id:REQUEST,actor:'owner',learnerId:LEARNER,teacherId:TEACHER,
  cycleId:CYCLE,startsAtMs:START};
 const good=mock({prior});
 assert.deepEqual(await ownerPaidSlotRequest(good.db,'owner',LEARNER,proposal,NOW),
  {status:200,code:'ACADEMY_PAID_SLOT_REPLAY',slotRequestId:REQUEST});
 for(const mismatch of [{...prior,actor:'other'},{...prior,learnerId:'other'},
  {...prior,startsAtMs:START+1000}]){
  const bad=mock({prior:mismatch});
  assert.equal((await ownerPaidSlotRequest(bad.db,'owner',LEARNER,proposal,NOW)).status,409);
  assert.equal(bad.queries.some(q=>q.sql.includes('INSERT INTO')),false);
 }
});

test('guardian and staff lists are bounded and deny foreign role before query',async()=>{
 const denied=mock({owner:false,staff:false});
 assert.equal((await ownerPaidSlotRequests(denied.db,'owner',LEARNER)).status,404);
 assert.equal((await staffPaidSlotRequests(denied.db,'staff')).status,403);
 assert.equal(denied.queries.some(q=>q.sql.includes('academy_paid_slot_request_events')),false);
 const owner=mock({rows:[{requestId:REQUEST,state:'pending'}]});
 const result=await ownerPaidSlotRequests(owner.db,'owner',LEARNER);
 assert.equal(result.status,200);
 assert.ok(owner.queries.some(q=>q.sql.includes('LIMIT 30')&&q.values[0]===LEARNER));
 const staff=mock();
 assert.equal((await staffPaidSlotRequests(staff.db,'staff')).status,200);
 const sql=staff.queries.find(q=>q.sql.includes('LIMIT 100'))?.sql??'';
 assert.doesNotMatch(sql,/phone_number|email|reason|password|payload_json/i);
});

test('staff decision uses server time, one D1 insert, fresh role and exact replay',async()=>{
 const m=mock();
 const result=await staffPaidSlotDecision(m.db,'staff',decision,NOW);
 assert.equal(result.status,201);
 assert.equal(result.code,'ACADEMY_PAID_SLOT_DECIDED');
 assert.ok('lessonId' in result);
 if('lessonId' in result)assert.match(String(result.lessonId),/^[0-9a-f-]{36}$/i);
 const insert=m.queries.find(q=>q.sql.includes('INSERT INTO academy_paid_slot_decision_events'));
 assert.ok(insert);
 assert.deepEqual(insert.values.slice(1,5),[OP,REQUEST,'staff','approved']);
 assert.deepEqual(insert.values.slice(-2),[decision.reason,NOW]);
 assert.equal(m.queries.filter(q=>q.sql.includes('INSERT INTO')).length,1);
 const prior={id:'prior',actor:'staff',requestId:REQUEST,
  decision:'approved',reason:decision.reason,lessonId:LEARNER};
 const replay=await staffPaidSlotDecision(mock({prior}).db,'staff',decision,NOW);
 assert.deepEqual(replay,{status:200,code:'ACADEMY_PAID_SLOT_DECISION_REPLAY',lessonId:LEARNER});
 const wrong=await staffPaidSlotDecision(mock({prior:{...prior,actor:'other'}}).db,
  'staff',decision,NOW);
 assert.equal(wrong.status,409);
});

test('staff denial, invalid input and database conflicts fail closed without false booking',async()=>{
 const denied=mock({staff:false});
 assert.deepEqual(await staffPaidSlotDecision(denied.db,'staff',decision,NOW),
  {status:403,code:'STAFF_ACCESS_DENIED'});
 assert.equal(denied.queries.some(q=>q.sql.includes('INSERT INTO')),false);
 for(const invalid of [{...decision,atMs:0},{...decision,lessonId:LEARNER},
  {...decision,decision:'accepted'},{...decision,reason:'bad'}]){
  const m=mock();
  assert.equal((await staffPaidSlotDecision(m.db,'staff',invalid,NOW)).status,400);
  assert.equal(m.queries.length,0);
 }
 const failed=mock({error:new Error('D1_ERROR: ACADEMY_SLOT_CYCLE_DENIED')});
 assert.deepEqual(await staffPaidSlotDecision(failed.db,'staff',decision,NOW),
  {status:409,code:'ACADEMY_PAID_SLOT_DECISION_DENIED'});
 const ownerFailed=mock({error:new Error('D1_ERROR: ACADEMY_SLOT_REQUEST_PENDING')});
 assert.equal((await ownerPaidSlotRequest(ownerFailed.db,'owner',LEARNER,proposal,NOW)).status,409);
 await assert.rejects(
  staffPaidSlotDecision(mock({error:new Error('Unexpected database failure')}).db,
   'staff',decision,NOW),/Unexpected database failure/);
});
