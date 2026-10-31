import {describe,expect,it} from 'vitest';
import {canonicalInk,parseCumulativePage,CumulativeReadError}
 from './cumulative-quran-client';

const learnerId='learner-001',page=35;
const teacher={itemId:'ink-teacher-001',page,kind:'pen',visible:true,
 authorRole:'teacher',audience:'shared',originType:'lesson',
 originId:'lesson-001',surah:null,ayah:null,
 payload:{color:'#abc123',width:3,points:[{x:12,y:20},{x:45,y:60}]}};
const note={itemId:'note-teacher-001',page,kind:'note',visible:true,
 authorRole:'teacher',audience:'shared',originType:'lesson',
 originId:'lesson-001',surah:67,ayah:3,payload:{color:'#abc123',text:'راجع المد'}};
const privateStroke={itemId:'private-ink-001',page,kind:'marker',visible:true,
 payload:{color:'#aabbcc',width:16,points:[{x:8,y:20},{x:25,y:40}]}};
const response={code:'QURAN_COMPOSITE_READ',learnerId,current:[teacher,note],
 legacyPrivate:[privateStroke]};

describe('owner cumulative Quran overlay — verified data, child isolation and private ink',()=>{
 it('decodes only signed owner composite response without mixing teacher and legacy student ink',()=>{
  const parsed=parseCumulativePage(response,learnerId,page);
  expect(parsed.marks).toHaveLength(2);
  expect(canonicalInk(parsed.marks[0]!)).toMatchObject({
   id:'ink-teacher-001',page,kind:'pen',color:'#abc123'});
  expect(parsed.legacyInk).toHaveLength(1);
  expect(parsed.legacyInk[0]).toMatchObject({id:'private-ink-001',kind:'marker'});
  expect(parsed.marks[1]).toMatchObject({kind:'note',surah:67,ayah:3});
 });
 it('rejects another sibling, teacher-only response or wrong page mark',()=>{
  for(const result of [
   {...response,learnerId:'sibling-002'},
   {...response,code:'QURAN_SHARED_READ'},
   {...response,current:[{...teacher,page:36}]},
   {...response,current:[{...teacher,audience:'wrong'}]},
   {...response,current:[{...teacher,originType:'hidden'}]}
  ])expect(()=>parseCumulativePage(result,learnerId,page)).toThrow(CumulativeReadError);
 });
 it('rejects missing or unverified payloads rather than generating fake ink',()=>{
  const parsed=parseCumulativePage({...response,
   current:[{...teacher,payload:{color:'red',width:4,points:[]}}],
   legacyPrivate:[{...privateStroke,payload:{color:'javascript:evil',width:16,points:[]}}]},
   learnerId,page);
  expect(canonicalInk(parsed.marks[0]!)).toBeNull();
  expect(parsed.legacyInk).toHaveLength(0);
 });
 it('never accepts more than the bounded page response or malformed metadata',()=>{
  expect(()=>parseCumulativePage({...response,current:Array.from({length:301},()=>teacher)},
   learnerId,page)).toThrow(CumulativeReadError);
  expect(()=>parseCumulativePage({...response,current:null},learnerId,page))
   .toThrow(CumulativeReadError);
 });
});
