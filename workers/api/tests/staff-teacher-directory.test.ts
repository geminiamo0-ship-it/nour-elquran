import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import type {CoreDatabase} from '../src/bindings.ts';
import {readAdminTeachers,ADMIN_TEACHERS_SQL,ADMIN_TEACHER_BY_ID_SQL,ADMIN_TEACHER_LIMIT} from '../src/staff-teacher-directory.ts';

const NOW=1793600000000;
const first={id:'teacher-1',name:'شيخ تجريبي',qualified:1,status:'active',
 currentLearners:2,upcomingLessons:3};
function fake(granted:boolean,rows:unknown) {
 const queries:{sql:string;args:unknown[]}[]=[];
 const db={
  prepare(sql:string){return {
   bind(...args:unknown[]){queries.push({sql,args});return {
    first:async()=>sql.includes('FROM staff_grants')
     ?(granted?{subject:'staff-subject'}:null):null,
    all:async()=>{
     if(sql!==ADMIN_TEACHERS_SQL&&sql!==ADMIN_TEACHER_BY_ID_SQL)
      throw Error('Unexpected non-directory query');
     return {results:rows};
    },
   };},
  };},
 } as unknown as CoreDatabase;
 return {db,queries};
}
test('signed valid staff sees only 50 bounded deterministic real D1 records',async()=>{
 const {db,queries}=fake(true,[first]);
 assert.deepEqual(await readAdminTeachers(db,'staff-subject',NOW),{
  status:200,code:'STAFF_TEACHER_DIRECTORY',asOfMs:NOW,readOnly:true,
  teachers:[{id:'teacher-1',name:'شيخ تجريبي',qualified:true,status:'active',
   currentLearners:2,upcomingLessons:3}],truncated:false,
 });
 assert.equal(queries.length,2);
 assert.deepEqual(queries[1]?.args,[NOW,NOW,NOW]);
 assert.match(ADMIN_TEACHERS_SQL,/ORDER BY user.name COLLATE NOCASE ASC, teacher.id ASC/);
 assert.match(ADMIN_TEACHERS_SQL,/LIMIT 51/);
 assert.doesNotMatch(ADMIN_TEACHERS_SQL,/phone_number|email|image|learner.display_name|credential|payload_json/);
 const huge=Array.from({length:51},(_,i)=>({...first,id:'teacher-'+i}));
 const capped=await readAdminTeachers(fake(true,huge).db,'staff-subject',NOW);
 assert.equal(capped.status,200);
 if(capped.status!==200)throw Error('Unexpected denial');
 assert.equal(capped.teachers.length,ADMIN_TEACHER_LIMIT);
 assert.equal(capped.truncated,true);
});
test('revoked/nonstaff denied before any teacher record is queried',async()=>{
 for(const subject of ['staff-subject','']){
  const {db,queries}=fake(false,[first]);
  assert.deepEqual(await readAdminTeachers(db,subject,NOW),
   {status:403,code:'STAFF_ACCESS_DENIED'});
  assert(queries.every(q=>q.sql!==ADMIN_TEACHERS_SQL));
  if(!subject)assert.equal(queries.length,0);
 }
});
test('never replaces malformed or unverifiable directory rows with fabricated data',async()=>{
 for(const rows of [null,{},[null],
  [{...first,name:''}],[{...first,qualified:true}],
  [{...first,currentLearners:-1}],
  [{...first,upcomingLessons:'3'}],
  [{...first,status:'pending'}],
  [{...first,email:'private@invalid',id:''}],
  Array.from({length:52},()=>first),
 ]){
  assert.deepEqual(await readAdminTeachers(fake(true,rows).db,'staff-subject',NOW),
   {status:503,code:'STAFF_TEACHERS_UNAVAILABLE'});
 }
 const {db,queries}=fake(true,[first]);
 assert.deepEqual(await readAdminTeachers(db,'staff-subject',NaN),
  {status:503,code:'CLOCK_UNAVAILABLE'});
 assert.equal(queries.length,0);
});
test('empty directory is a truthful empty array and disabled is not active',async()=>{
 const empty=await readAdminTeachers(fake(true,[]).db,'staff-subject',NOW);
 assert.equal(empty.status,200);
 if(empty.status!==200)throw Error('Unexpected denial');
 assert.deepEqual(empty.teachers,[]);
 const disabled=await readAdminTeachers(fake(true,[{...first,status:'disabled',qualified:0}]).db,
  'staff-subject',NOW);
 assert.equal(disabled.status,200);
 if(disabled.status!==200)throw Error('Unexpected denial');
 assert.deepEqual(disabled.teachers,[{id:'teacher-1',name:'شيخ تجريبي',
  qualified:false,status:'disabled',currentLearners:2,upcomingLessons:3}]);
});

test('exact teacher ID lookup reaches a record beyond the first 50 without unbounded SQL',async()=>{
 const {db,queries}=fake(true,[{...first,id:'teacher-75'}]);
 const result=await readAdminTeachers(db,'staff-subject',NOW,'teacher-75');
 assert.equal(result.status,200);
 if(result.status!==200)throw Error('Unexpected denial');
 assert.deepEqual(result.teachers.map(t=>t.id),['teacher-75']);
 assert.equal(result.truncated,false);
 assert.equal(queries.length,2);
 assert.equal(queries[1]?.sql,ADMIN_TEACHER_BY_ID_SQL);
 assert.deepEqual(queries[1]?.args,[NOW,NOW,NOW,'teacher-75']);
 assert.match(ADMIN_TEACHER_BY_ID_SQL,/WHERE teacher.id=\?/);
 assert.match(ADMIN_TEACHER_BY_ID_SQL,/LIMIT 1/);
 assert.doesNotMatch(ADMIN_TEACHER_BY_ID_SQL,/phone_number|email|auth_subject AS|learner.display_name|payload_json/);
 const missing=await readAdminTeachers(fake(true,[]).db,'staff-subject',NOW,'teacher-75');
 assert.equal(missing.status,200);
 if(missing.status!==200)throw Error('Unexpected denial');
 assert.deepEqual(missing.teachers,[]);
 assert.equal(missing.truncated,false);
});
test('exact ID lookup rejects malformed input, revoked grant and duplicate D1 rows',async()=>{
 for(const id of ['', '../other','teacher_1','a'.repeat(129)]){
  const {db,queries}=fake(true,[first]);
  assert.deepEqual(await readAdminTeachers(db,'staff-subject',NOW,id),
   {status:400,code:'INVALID_TEACHER_LOOKUP'});
  assert.equal(queries.length,0);
 }
 const denied=fake(false,[first]);
 assert.deepEqual(await readAdminTeachers(denied.db,'staff-subject',NOW,'teacher-1'),
  {status:403,code:'STAFF_ACCESS_DENIED'});
 assert(denied.queries.every(q=>q.sql!==ADMIN_TEACHER_BY_ID_SQL));
 const duplicate=await readAdminTeachers(fake(true,[first,first]).db,
  'staff-subject',NOW,'teacher-1');
 assert.deepEqual(duplicate,{status:503,code:'STAFF_TEACHERS_UNAVAILABLE'});
});

test('Worker fails closed on a mismatched exact-ID adapter receipt and duplicate directory IDs',async()=>{
 const wrong=await readAdminTeachers(fake(true,[{...first,id:'teacher-74'}]).db,
  'staff-subject',NOW,'teacher-75');
 assert.deepEqual(wrong,{status:503,code:'STAFF_TEACHERS_UNAVAILABLE'});
 const duplicates=await readAdminTeachers(fake(true,[first,first]).db,
  'staff-subject',NOW);
 assert.deepEqual(duplicates,{status:503,code:'STAFF_TEACHERS_UNAVAILABLE'});
 const distinct=await readAdminTeachers(fake(true,[first,{...first,id:'teacher-2'}]).db,
  'staff-subject',NOW);
 assert.equal(distinct.status,200);
 if(distinct.status!==200)throw Error('Unexpected denial');
 assert.deepEqual(distinct.teachers.map(t=>t.id),['teacher-1','teacher-2']);
});
