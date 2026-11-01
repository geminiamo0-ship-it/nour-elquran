import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import type {CoreDatabase} from '../src/bindings.ts';
import {readAdminTeachers,ADMIN_TEACHERS_SQL,ADMIN_TEACHER_LIMIT} from '../src/staff-teacher-directory.ts';

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
     if(sql!==ADMIN_TEACHERS_SQL)throw Error('Unexpected non-directory query');
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
