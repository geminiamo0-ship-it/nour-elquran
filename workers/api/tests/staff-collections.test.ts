import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import type {CoreDatabase} from '../src/bindings.ts';
import {readStaffCollection,COLLECTION_QUERIES,COLLECTION_FIELDS,
 isAdminCollectionView,ADMIN_COLLECTION_VIEWS} from '../src/staff-collections.ts';

const NOW=1793600000000;
const sample={
 students:{id:'learner-a',name:'طالب تجريبي',learnerType:'child',status:'active',lessonCount:2},
 schedule:{id:'lesson-a',startsAtMs:NOW+3000000,kind:'trial',status:'scheduled',
  learnerName:'طالب تجريبي',teacherName:'شيخ تجريبي'},
 subscriptions:{id:'cycle-a',learnerName:'طالب تجريبي',startsAtMs:NOW,
  endsAtMs:NOW+2592000000,baseSessions:8,rolloverSessions:1,spentSessions:2},
 attendance:{id:'appeal-a',kind:'student_no_show',submittedAtMs:NOW,decision:'pending'},
} as const;
function make(granted:boolean,rows:unknown){
 const queries:{sql:string,args:unknown[]}[]=[];
 const db={prepare(sql:string){return{bind(...args:unknown[]){
  queries.push({sql,args});
  return {
   first:async()=>sql.includes('FROM staff_grants')
    ?(granted?{subject:'staff-subject'}:null):null,
   all:async()=>({results:rows}),
  };
 }};}} as unknown as CoreDatabase;
 return {db,queries};
}
test('four fixed SQL views refuse dynamic or unsupported collection identifiers',()=>{
 assert.deepEqual([...ADMIN_COLLECTION_VIEWS],Object.keys(sample));
 assert.equal(isAdminCollectionView('students'),true);
 for(const view of ['students;DROP TABLE learners','../schedule','finance',''])
  assert.equal(isAdminCollectionView(view),false);
 for(const view of ADMIN_COLLECTION_VIEWS){
  assert.match(COLLECTION_QUERIES[view],/LIMIT 51/);
  assert.match(COLLECTION_QUERIES[view],/ORDER BY /);
  assert.doesNotMatch(COLLECTION_QUERIES[view],/phone_number|email|reason|password|payload_json/i);
  assert.equal(Object.keys(sample[view]).length,COLLECTION_FIELDS[view].length);
 }
});
test('only verified D1 staff grant may query one bounded deterministic dataset',async()=>{
 for(const view of ADMIN_COLLECTION_VIEWS){
  const {db,queries}=make(true,[sample[view]]);
  const result=await readStaffCollection(db,'staff-subject',view,NOW);
  assert.deepEqual(result,{status:200,code:'STAFF_COLLECTION',view,
   asOfMs:NOW,readOnly:true,rows:[sample[view]],truncated:false});
  assert.equal(queries.length,2);
  assert.equal(queries[1]?.sql,COLLECTION_QUERIES[view]);
  assert.equal(queries[1]?.args.length,view==='schedule'?2:0);
  const large=await readStaffCollection(
   make(true,Array.from({length:51},(_,i)=>({...sample[view],id:'unique-'+i}))).db,
   'staff-subject',view,NOW);
  assert.equal(large.status,200);
  if(large.status===200){assert.equal(large.rows.length,50);assert.equal(large.truncated,true);}
 }
});
test('unsigned, nonstaff and revoked staff denied before any dataset query',async()=>{
 for(const view of ADMIN_COLLECTION_VIEWS){
  for(const subject of ['staff-subject','']){
   const {db,queries}=make(false,[sample[view]]);
   assert.deepEqual(await readStaffCollection(db,subject,view,NOW),
    {status:403,code:'STAFF_ACCESS_DENIED'});
   assert.equal(queries.some(q=>q.sql===COLLECTION_QUERIES[view]),false);
   if(!subject)assert.equal(queries.length,0);
  }
 }
});
test('no fake zero or partial result is presented for invalid D1 data',async()=>{
 for(const view of ADMIN_COLLECTION_VIEWS){
  for(const rows of [null,[null],[{...sample[view],phone:'private'}],
   [{...sample[view],id:''}],
   [sample[view],sample[view]],
   Array.from({length:52},(_,i)=>({...sample[view],id:'item-'+i}))]){
   assert.deepEqual(await readStaffCollection(make(true,rows).db,'staff-subject',view,NOW),
    {status:503,code:'STAFF_COLLECTION_UNAVAILABLE'});
  }
  const empty=await readStaffCollection(make(true,[]).db,'staff-subject',view,NOW);
  assert.equal(empty.status,200);
  if(empty.status===200)assert.deepEqual(empty.rows,[]);
 }
 assert.deepEqual(await readStaffCollection(make(true,[]).db,'staff-subject','students',NaN),
  {status:503,code:'CLOCK_UNAVAILABLE'});
});
test('subscription units and attendance state may not be coerced into fake numbers',async()=>{
 for(const value of [-1,'8',true,Infinity,1.25,10000]){
  assert.equal((await readStaffCollection(
   make(true,[{...sample.subscriptions,spentSessions:value}]).db,
   'staff-subject','subscriptions',NOW)).status,503);
 }
 for(const decision of ['paid','resolved','unknown']){
  assert.equal((await readStaffCollection(make(true,[{...sample.attendance,decision}]).db,
   'staff-subject','attendance',NOW)).status,503);
 }
});
