import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import type {CoreDatabase} from '../src/bindings.ts';
import {readStaffOverview,STAFF_OVERVIEW_SQL} from '../src/staff-overview.ts';

const NOW=1793600000000;
function fake(granted:boolean,row:unknown){
 const queries:{sql:string;args:unknown[]}[]=[];
 const db={
  prepare(sql:string){
   return {
    bind(...args:unknown[]){
     queries.push({sql,args});
     return {first:async()=>{
      if(sql.includes('FROM staff_grants'))return granted?{subject:'staff-subject'}:null;
      if(sql===STAFF_OVERVIEW_SQL)return row;
      throw Error('unexpected SQL');
     }};
    }
   };
  }
 } as unknown as CoreDatabase;
 return {db,queries};
}

test('verified active staff reads only aggregate D1 counts with an exact timestamp',async()=>{
 const {db,queries}=fake(true,{
  activeLearners:18,activeQualifiedTeachers:2,upcomingLessons:3,completedLessons:7,
 });
 const result=await readStaffOverview(db,'staff-subject',NOW);
 assert.deepEqual(result,{
  status:200,code:'STAFF_OVERVIEW',asOfMs:NOW,readOnly:true,
  metrics:{activeLearners:18,activeQualifiedTeachers:2,upcomingLessons:3,completedLessons:7},
 });
 assert.equal(queries.length,2);
 assert.deepEqual(queries[1]?.args,[NOW]);
 assert.match(STAFF_OVERVIEW_SQL,/status='scheduled' AND starts_at_ms>=\?/);
 assert.doesNotMatch(STAFF_OVERVIEW_SQL,/display_name|phone_number|auth_subject/);
 assert.equal(JSON.stringify(result).includes('child'),false);
});

test('nonstaff or revoked staff denied before any overview SQL or personal data read',async()=>{
 for(const subject of ['staff-subject','']) {
  const {db,queries}=fake(false,{activeLearners:22});
  assert.deepEqual(await readStaffOverview(db,subject,NOW),{
   status:403,code:'STAFF_ACCESS_DENIED',
  });
  assert.equal(queries.some(q=>q.sql===STAFF_OVERVIEW_SQL),false);
  if(subject==='')assert.equal(queries.length,0);
 }
});

test('a broken or contradictory database aggregate never becomes a fabricated zero',async()=>{
 for(const row of [null,{activeLearners:1.2,activeQualifiedTeachers:0,
   upcomingLessons:0,completedLessons:0},
   {activeLearners:0,activeQualifiedTeachers:0,upcomingLessons:-1,completedLessons:0},
   {activeLearners:'5',activeQualifiedTeachers:0,upcomingLessons:0,completedLessons:0}]) {
  const {db}=fake(true,row);
  assert.deepEqual(await readStaffOverview(db,'staff-subject',NOW),{
   status:503,code:'STAFF_OVERVIEW_UNAVAILABLE',
  });
 }
 const {db,queries}=fake(true,{});
 assert.deepEqual(await readStaffOverview(db,'staff-subject',NaN),{
  status:503,code:'CLOCK_UNAVAILABLE',
 });
 assert.equal(queries.length,0);
});
