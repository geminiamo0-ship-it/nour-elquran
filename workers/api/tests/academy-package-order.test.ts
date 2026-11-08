import test from 'node:test';
import assert from 'node:assert/strict';
import {staffPackage} from '../src/academy-admin-mvp.ts';
import type {CoreDatabase} from '../src/bindings.ts';

const STAFF='synthetic-staff';
const PACKAGE='11111111-1111-4111-8111-111111111111';
const OP='22222222-2222-4222-8222-222222222222';
const command={operationId:OP,packageId:PACKAGE,title:'Eight Quran classes',
 priceEgp:1600,sessions:8,active:true};

function fixture(options:{authorized?:boolean;existing?:Record<string,unknown>|null;
 raced?:Record<string,unknown>|null;writeError?:string;
 writeResult?:{success:boolean;meta:{changes:number}}}={}){
 const writes:Array<{sql:string;values:unknown[]}>=[],queries:string[]=[];
 let inserted=false;
 const db={
  prepare(sql:string){
   queries.push(sql);
   let values:unknown[]=[];
   return {
    bind(...args:unknown[]){values=args;return this;},
    async first(){
     if(sql.includes('FROM academy_package_events')&&sql.includes('operation_id=?'))
      return inserted&&options.raced!==undefined?options.raced:options.existing??null;
     return options.authorized===false?null:{subject:STAFF};
    },
    async run(){
     inserted=true;writes.push({sql,values});
     if(options.writeError)throw Error(options.writeError);
     return options.writeResult??{success:true,meta:{changes:1}};
    },
   };
  },
 } as unknown as CoreDatabase;
 return {db,writes,queries};
}

test('staff package version clock is assigned inside the D1 INSERT, not a stale read',async()=>{
 const f=fixture();
 assert.deepEqual(await staffPackage(f.db,STAFF,command,1700000000000),
  {status:201,code:'ACADEMY_PACKAGE_SAVED',packageId:PACKAGE});
 assert.equal(f.writes.length,1);
 const {sql,values}=f.writes[0]!;
 assert.match(sql,/INSERT INTO academy_package_events/);
 assert.match(sql,/SELECT \?,\?,\?,\?,\?,\?,\?,\?,/);
 assert.match(sql,/MAX\(\?,COALESCE\(\(SELECT MAX\(at_ms\)\+1 FROM academy_package_events/);
 assert.match(sql,/WHERE package_id=\?/);
 assert.deepEqual(values.slice(8),[1700000000000,PACKAGE,1700000000000]);
 assert.equal(f.queries.filter(q=>q.includes('FROM academy_package_events')).length,2,
  'No separate current-package timestamp read before the write');
});

test('simultaneous identical staff operation recovers its committed version',async()=>{
 const existing={id:'33333333-3333-4333-8333-333333333333',
  actor:STAFF,packageId:PACKAGE,title:command.title,priceEgp:1600,
  sessions:8,active:1};
 const f=fixture({writeError:'UNIQUE constraint failed: academy_package_events.operation_id',
  raced:existing});
 assert.deepEqual(await staffPackage(f.db,STAFF,command),
  {status:200,code:'ACADEMY_PACKAGE_REPLAY',packageId:PACKAGE});
 assert.equal(f.writes.length,1);
 const conflict=fixture({writeError:'UNIQUE constraint failed: academy_package_events.operation_id',
  raced:{...existing,priceEgp:1800}});
 assert.deepEqual(await staffPackage(conflict.db,STAFF,command),
  {status:409,code:'ACADEMY_OPERATION_CONFLICT'});
});

test('staff role denial and unrelated write constraint fail closed',async()=>{
 const denied=fixture({authorized:false});
 assert.deepEqual(await staffPackage(denied.db,STAFF,command),
  {status:403,code:'STAFF_ACCESS_DENIED'});
 assert.equal(denied.writes.length,0);
 const blocked=fixture({writeError:'ACADEMY_STAFF_DENIED'});
 assert.deepEqual(await staffPackage(blocked.db,STAFF,command),
  {status:409,code:'ACADEMY_PACKAGE_DENIED'});
 assert.equal(blocked.writes.length,1);
});

test('operation replay never acknowledges another staff actor or package',async()=>{
 const saved={id:'33333333-3333-4333-8333-333333333333',
  actor:STAFF,packageId:PACKAGE,title:command.title,priceEgp:1600,
  sessions:8,active:1};
 for(const collision of [
  {...saved,actor:'different-synthetic-staff'},
  {...saved,packageId:'44444444-4444-4444-8444-444444444444'},
 ]){
  // An existing operation collision must be rejected before any new write.
  const preexisting=fixture({existing:collision});
  assert.deepEqual(await staffPackage(preexisting.db,STAFF,command),
   {status:409,code:'ACADEMY_OPERATION_CONFLICT'});
  assert.equal(preexisting.writes.length,0);

  // The same collision can arrive only after another request wins the
  // UNIQUE constraint. It must never return the other actor's package ID.
  const raced=fixture({writeError:'UNIQUE constraint failed: academy_package_events.operation_id',
   raced:collision});
  assert.deepEqual(await staffPackage(raced.db,STAFF,command),
   {status:409,code:'ACADEMY_OPERATION_CONFLICT'});
  assert.equal(raced.writes.length,1);
 }
});

test('unexpected D1 outage propagates rather than inventing a saved package',async()=>{
 const f=fixture({writeError:'D1_ERROR: database unavailable'});
 await assert.rejects(staffPackage(f.db,STAFF,command),/D1_ERROR: database unavailable/);
 assert.equal(f.writes.length,1);
});

test('resolved D1 failure or zero affected rows cannot acknowledge a package price',async()=>{
 for(const receipt of [
  {success:false,meta:{changes:0}},
  {success:true,meta:{changes:0}},
 ]) {
  const f=fixture({writeResult:receipt});
  assert.deepEqual(await staffPackage(f.db,STAFF,command),
   {status:503,code:'ACADEMY_PACKAGE_STORAGE_UNAVAILABLE'});
  assert.equal(f.writes.length,1);
 }
});


test('ambiguous D1 transaction abort is unavailable, never a proven 409 conflict',async()=>{
 for(const message of ['D1_ERROR: request aborted','Transaction aborted']){
  const f=fixture({writeError:message});
  assert.deepEqual(await staffPackage(f.db,STAFF,command),
   {status:503,code:'ACADEMY_PACKAGE_STORAGE_UNAVAILABLE'});
  assert.equal(f.writes.length,1);
 }
});

test('an abort after commit still replays the same immutable staff operation',async()=>{
 const committed={id:'33333333-3333-4333-8333-333333333333',
  actor:STAFF,packageId:PACKAGE,title:command.title,priceEgp:1600,
  sessions:8,active:1};
 const f=fixture({writeError:'Transaction aborted',raced:committed});
 assert.deepEqual(await staffPackage(f.db,STAFF,command),
  {status:200,code:'ACADEMY_PACKAGE_REPLAY',packageId:PACKAGE});
 assert.equal(f.writes.length,1);
});

test('uncertain resolved D1 receipt replays only the exact durable staff package edit',async()=>{
 const committed={id:'33333333-3333-4333-8333-333333333333',
  actor:STAFF,packageId:PACKAGE,title:command.title,priceEgp:1600,
  sessions:8,active:1};
 for(const receipt of [
  {success:false,meta:{changes:0}},
  {success:true,meta:{changes:0}},
 ]) {
  const exact=fixture({writeResult:receipt,raced:committed});
  assert.deepEqual(await staffPackage(exact.db,STAFF,command),
   {status:200,code:'ACADEMY_PACKAGE_REPLAY',packageId:PACKAGE});
  assert.equal(exact.writes.length,1);

  const otherPrice=fixture({writeResult:receipt,raced:{...committed,priceEgp:1800}});
  assert.deepEqual(await staffPackage(otherPrice.db,STAFF,command),
   {status:409,code:'ACADEMY_OPERATION_CONFLICT'});
  assert.equal(otherPrice.writes.length,1);

  const otherActor=fixture({writeResult:receipt,raced:{...committed,actor:'other-staff'}});
  assert.deepEqual(await staffPackage(otherActor.db,STAFF,command),
   {status:409,code:'ACADEMY_OPERATION_CONFLICT'});
  assert.equal(otherActor.writes.length,1);
 }
});
