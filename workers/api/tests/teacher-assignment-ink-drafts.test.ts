import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {parseTeacherDraftSave} from '../src/teacher-assignment-ink-drafts.ts';
import {parsePublishAssignment} from '../src/published-assignments.ts';

const draftId='6145a6fa-1d94-4994-91e7-5819692ba3b6';
const operationId='1259864c-5af2-40d3-b54c-a9d7f196be26';
const pen={id:'sheikh-pen-001',kind:'pen',page:1,surah:null,ayah:null,
 payload:{color:'#ff0000',width:3,points:[{x:50,y:80},{x:60,y:95}]}};
const note={id:'sheikh-note-001',kind:'note',page:1,surah:1,ayah:2,
 payload:{color:'#113355',text:'راجع المد'}};
const ok={draftId,revision:1,kind:'memorization',editionId:'hafs-kfqc:v1.1.1',
 surah:1,fromAyah:1,toAyah:5,dueAtMs:1799999999000,
 instructions:'حفظ الآيات',marks:[pen,note]};

test('teacher ink drafts accept only bounded Quran marks without actor claims',()=>{
 assert.deepEqual(parseTeacherDraftSave(ok),ok);
 for(const bad of [
  {...ok,actorSubject:'teacher-a'},{...ok,learnerId:'sibling'},
  {...ok,revision:0},{...ok,revision:1.2},{...ok,kind:'admin'},
  {...ok,marks:[pen,pen]}, {...ok,marks:Array.from({length:25},(_,i)=>({...pen,id:'mark-'+String(i).padStart(8,'0')}))},
  {...ok,marks:[{...pen,page:605}]},
  {...ok,marks:[{...pen,payload:{...pen.payload,points:[{x:-1,y:0},{x:1,y:1}]}}]},
  {...ok,marks:[{...pen,payload:{...pen.payload,width:200}}]},
  {...ok,marks:[{...note,ayah:null}]},
  {...ok,marks:[{...note,payload:{color:'#bad',text:'n'}}]},
  {...ok,marks:[{...note,payload:{color:'#113355',text:''}}]},
  {...ok,marks:[{...pen,surah:1,ayah:2}]},
  null,[]
 ])assert.equal(parseTeacherDraftSave(bad),null,JSON.stringify(bad));
});

test('assignment publishing allows only a signed snapshot UUID and rejects extra fields',()=>{
 const basic={operationId,kind:ok.kind,editionId:ok.editionId,
  surah:ok.surah,fromAyah:ok.fromAyah,toAyah:ok.toAyah,
  dueAtMs:ok.dueAtMs,instructions:ok.instructions};
 assert.deepEqual(parsePublishAssignment({...basic,draftId}),{...basic,draftId});
 assert.deepEqual(parsePublishAssignment(basic),basic);
 for(const bad of [
  {...basic,draftId:'not-valid'},{...basic,draftId:3},
  {...basic,draftId,teacherId:'forged'},{...basic,marks:[pen]},
 ])assert.equal(parsePublishAssignment(bad),null);
});
