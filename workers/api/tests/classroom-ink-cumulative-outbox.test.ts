import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {initialInk,applyInk,type InkStroke,type VerifiedInkCommand} from '../src/classroom/quran-ink.ts';
import {prepareCumulativeInkDelivery,queueCumulativeInk,MAX_PENDING_QURAN_INK}
 from '../src/classroom/ink-cumulative-outbox.ts';
import {parseQuranLedgerCommand} from '../src/learner-quran-ledger.ts';

const stroke:InkStroke={id:'ink-stroke-001',page:35,kind:'pen',color:'#abc123',width:3,
 points:[{x:50,y:30},{x:70,y:45}]};
const source:VerifiedInkCommand={lessonId:'lesson-room-001',learnerId:'learner-001',
 actorSubject:'signed-sheikh',role:'teacher',action:'add',page:35,
 expectedRevision:0,requestId:'ink-add-00001',stroke};
const student:VerifiedInkCommand={...source,actorSubject:'signed-owner',
 role:'learner',requestId:'ink-learner-001'};
test('D1 delivery keys are deterministic, strict UUID, and unique per lesson/stroke',async()=>{
 const a=await prepareCumulativeInkDelivery(source,initialInk(35),10000);
 const a2=await prepareCumulativeInkDelivery(source,initialInk(35),99999);
 assert.ok(a);assert.ok(a2);
 assert.equal(a.command.operationId,a2.command.operationId);
 assert.equal(a.command.itemId,a2.command.itemId);
 assert.match(a.command.operationId,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
 assert.deepEqual(parseQuranLedgerCommand(a.command),a.command);
 assert.equal(a.command.originId,'lesson-room-001');
 assert.equal(a.command.expectedRevision,0);
 assert.deepEqual(a.command.payload,{color:stroke.color,width:stroke.width,points:stroke.points});
 assert.equal(a.actorRole,'teacher');
 const other=await prepareCumulativeInkDelivery({...source,lessonId:'lesson-room-002'},
  initialInk(35),10000);
 assert.notEqual(other?.command.itemId,a.command.itemId);
 const learner=await prepareCumulativeInkDelivery(student,initialInk(35),10000);
 assert.notEqual(learner?.operationId,a.operationId);
});
test('erase points at same immutable Quran item without stealing learner authorship',async()=>{
 const before=applyInk(initialInk(35),student).next;
 assert.equal(before.records[0]?.author,'learner');
 const teacherHide={...source,action:'hide' as const,stroke:undefined,
  strokeId:stroke.id,requestId:'ink-teacher-erase-0001',expectedRevision:1};
 const removal=await prepareCumulativeInkDelivery(teacherHide,before,12000);
 const addition=await prepareCumulativeInkDelivery(student,initialInk(35),11000);
 assert.ok(removal);assert.ok(addition);
 assert.equal(removal.command.action,'hide');
 assert.deepEqual(removal.command.payload,{});
 assert.equal(removal.command.expectedRevision,1);
 assert.equal(removal.command.itemId,addition.command.itemId);
 assert.equal(removal.actorRole,'teacher');
 assert.equal(addition.actorRole,'learner');
 assert.notEqual(removal.command.operationId,addition.command.operationId);
 assert.deepEqual(parseQuranLedgerCommand(removal.command),removal.command);
});
test('fail closed on incorrect source page, no existing erase target, or forged ID',async()=>{
 assert.equal(await prepareCumulativeInkDelivery(source,initialInk(36),10000),null);
 assert.equal(await prepareCumulativeInkDelivery({...source,actorSubject:'../bad'},
  initialInk(35),10000),null);
 const erase={...source,action:'hide' as const,stroke:undefined,
  strokeId:'not-here-001',expectedRevision:0};
 assert.equal(await prepareCumulativeInkDelivery(erase,initialInk(35),10000),null);
 assert.equal(await prepareCumulativeInkDelivery({...source,action:'snapshot',
  requestId:undefined,stroke:undefined},initialInk(35),10000),null);
});
test('bounded ordered outbox never drops pending writes, rejects changed idempotency',async()=>{
 const first=await prepareCumulativeInkDelivery(source,initialInk(35),10);
 assert.ok(first);
 const one=queueCumulativeInk([],first);
 assert.equal(one.code,'QUEUED');
 assert.equal(one.items.length,1);
 const retry={...first,acceptedAtMs:11};
 const replay=queueCumulativeInk(one.items,retry);
 assert.equal(replay.code,'REPLAY');
 assert.deepEqual(replay.items,one.items);
 const collide=queueCumulativeInk(one.items,{
  ...first,command:{...first.command,payload:{color:'#000000',width:3,points:stroke.points}}
 });
 assert.equal(collide.code,'CONFLICT');
 const full=Array.from({length:MAX_PENDING_QURAN_INK},(_,i)=>({...first,operationId:'op-'+i}));
 assert.equal(queueCumulativeInk(full,first).code,'FULL');
 assert.equal(queueCumulativeInk(full,first).items.length,MAX_PENDING_QURAN_INK);
});
