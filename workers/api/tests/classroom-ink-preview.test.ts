import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseInkPreview,parseRemoteInkPreview,MAX_PREVIEW_POINTS,MAX_PREVIEW_BYTES}
 from '../src/classroom/ink-preview.ts';
const base={type:'ink-preview',phase:'start',strokeId:'ink-preview-00001',
 page:35,seq:0,color:'#397ca7',kind:'pen',width:3,points:[{x:1,y:2}]};
test('strict bounded provisional preview schema, no fake save payloads',()=>{
 assert.ok(parseInkPreview(base));
 assert.ok(parseRemoteInkPreview({...base,source:'teacher'}));
 assert.equal(MAX_PREVIEW_POINTS,64);
 assert.ok(MAX_PREVIEW_BYTES<4096);
 for(const invalid of [
  {...base,strokeId:'short'},
  {...base,phase:'write'},
  {...base,phase:'end',points:[{x:1,y:2}]},
  {...base,phase:'start',points:[]},
  {...base,points:Array.from({length:65},()=>({x:1,y:2}))},
  {...base,points:[{x:1001,y:1}]},
  {...base,points:[{x:1,y:-1}]},
  {...base,width:16},
  {...base,seq:-1},
  {...base,page:605},
  {...base,author:'student'},
  {...base,saved:true},
 ])assert.equal(parseInkPreview(invalid),null);
 assert.equal(parseRemoteInkPreview({...base,source:'forged'}),null);
 assert.equal(parseRemoteInkPreview(base),null);
});
