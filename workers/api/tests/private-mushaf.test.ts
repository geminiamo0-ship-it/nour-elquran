import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parsePrivateMushafOp,PRIVATE_EDITION,applyPrivateMushaf,readPrivateMushaf} from '../src/private-mushaf.ts';
import type {CoreDatabase} from '../src/bindings.ts';
const valid={operationId:'00000000-0000-4000-8000-000000000001',action:'put' as const,
  itemId:'ink-1',kind:'pen' as const,page:12,expectedVersion:0,
  payload:{points:[{x:1,y:2},{x:123,y:1594}],color:'#f6cd46',width:3}};
test('allowlisted private operation validates precise bounds and no caller role',()=>{
 assert.deepEqual(parsePrivateMushafOp(valid),valid);
 for(const bad of [null,[],{...valid,actor:'teacher'},{...valid,learnerId:'another'},
  {...valid,page:605},{...valid,itemId:'a;DROP TABLE'},
  {...valid,expectedVersion:-1},{...valid,payload:{...valid.payload,points:[{x:-1,y:2},{x:3,y:4}]}},
  {...valid,payload:{...valid.payload,color:'url(javascript:alert(1))'}},
  {...valid,payload:{...valid.payload,points:Array.from({length:2501},()=>({x:0,y:0}))}},
  {...valid,operationId:'wrong'},{...valid,action:'hide',payload:valid.payload},
 ])assert.equal(parsePrivateMushafOp(bad),null);
 assert.equal(PRIVATE_EDITION,'hafs-kfqc:v1.1.1');
});
test('notes, marker, bookmark and position require bounded stable resource shapes',()=>{
 assert.ok(parsePrivateMushafOp({...valid,kind:'note',itemId:'note-1-2',payload:{
  target:{surah:1,ayah:2,wordIndex:null},text:'مراجعة',color:'#aabbcc'}}));
 assert.equal(parsePrivateMushafOp({...valid,kind:'note',itemId:'note-1-2',payload:{
  target:{surah:1,ayah:2,wordIndex:null},text:'',color:'#aabbcc'}}),null);
 assert.ok(parsePrivateMushafOp({...valid,kind:'marker',payload:valid.payload}));
 assert.ok(parsePrivateMushafOp({...valid,kind:'bookmark',itemId:'bookmark-12',payload:{}}));
 assert.ok(parsePrivateMushafOp({...valid,kind:'position',itemId:'position',payload:{}}));
 assert.equal(parsePrivateMushafOp({...valid,kind:'position',itemId:'forged',payload:{}}),null);
 assert.ok(parsePrivateMushafOp({...valid,action:'hide',expectedVersion:1,payload:{}}));
});
test('event write binds verified actor/learner and returns D1-acknowledged version',async()=>{
 const calls:Array<{sql:string;args:unknown[]}>=[];
 const db={prepare:(sql:string)=>({bind:(...args:unknown[])=>{
  calls.push({sql,args});return {first:async()=>sql.includes('private_mushaf_items')
   ?{itemId:'ink-1',kind:'pen',page:12,visible:1,version:1,payloadJson:JSON.stringify(valid.payload)}
   :null,run:async()=>({success:true,meta:{changes:1}})};
 }})} as unknown as CoreDatabase;
 const result=await applyPrivateMushaf(db,'verified-auth','owned-learner',valid);
 assert.equal(result.status,201);
 assert.equal(result.item?.version,1);
 assert.deepEqual(calls[1]?.args.slice(1,9),['owned-learner','verified-auth',valid.operationId,
  'put','ink-1','pen',PRIVATE_EDITION,12]);
});
test('hidden stable-ID metadata survives reload without loading erased strokes',async()=>{
 const queries:string[]=[];
 const db={prepare:(sql:string)=>({bind:()=>({all:async()=>{
  queries.push(sql);
  return {results:[sql.includes('page=?')
   ?{itemId:'note-1-1-0',kind:'note',page:12,visible:0,version:2,payloadJson:'{}'}
   :{itemId:'bookmark-12',kind:'bookmark',page:12,visible:0,version:2,payloadJson:'{}'}]};
 }})})} as unknown as CoreDatabase;
 const page=await readPrivateMushaf(db,'owned',12);
 const index=await readPrivateMushaf(db,'owned',null);
 assert.equal(page.items?.[0]?.visible,false);
 assert.equal(page.items?.[0]?.version,2);
 assert.equal(index.items?.[0]?.visible,false);
 assert.equal(index.items?.[0]?.version,2);
 assert.ok(queries[0]?.includes("visible=1 OR kind IN ('note','highlight')"));
 assert.ok(!queries[1]?.includes('visible=1'));
});
test('index read never takes supplied actor or unrelated learner ID',async()=>{
 const args:unknown[][]=[];
 const db={prepare:()=>({bind:(...items:unknown[])=>{
  args.push(items);return {all:async()=>({results:[]})};
 }})} as unknown as CoreDatabase;
 assert.deepEqual(await readPrivateMushaf(db,'owned',12),
  {status:200,code:'QURAN_LOADED',items:[]});
 assert.deepEqual(args[0],['owned',PRIVATE_EDITION,12]);
 assert.deepEqual((await readPrivateMushaf(db,'owned',null)).items,[]);
 assert.deepEqual(args[1],['owned',PRIVATE_EDITION]);
});
