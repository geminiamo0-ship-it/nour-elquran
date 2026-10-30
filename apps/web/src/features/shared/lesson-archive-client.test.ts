import {describe,expect,it} from 'vitest';
import {parsePublishedQuranArchive,archiveStrokes,ArchiveError} from './lesson-archive-client';
const base={
 lessonId:'lesson-1',learnerId:'learner-1',reportRevision:1,
 editionId:'hafs-kfqc:v1.1.1',source:'classroom-do:v1',
 sourceSha256:'a'.repeat(64),sealedAtMs:4000,pages:[1,2],
 marks:[{id:'note-1',page:1,surah:1,ayah:1,kind:'note',payload:{text:'تصحيح',color:'#AA0000'}},
  {id:'ink-1',page:1,surah:null,ayah:null,kind:'pen',payload:{
   color:'#00AA00',width:3,points:[{x:2,y:3},{x:5,y:9}]}}]
};
describe('read-only published Quran archive',()=>{
 it('accepts only a sealed canonical matching DTO and derives original ink without mutation',()=>{
  const parsed=parsePublishedQuranArchive({archive:base});
  expect(parsed).not.toBeNull();
  expect(parsed!.pages).toEqual([1,2]);
  expect(archiveStrokes(parsed!,1)).toMatchObject([{id:'ink-1',page:1,kind:'pen'}]);
  expect(archiveStrokes(parsed!,2)).toEqual([]);
  expect(parsePublishedQuranArchive({archive:null})).toBeNull();
 });
 it('refuses unsealed, forged edition, outsider pages, corrupt annotations and points',()=>{
  const bad=[
   {...base,editionId:'another-edition'},
   {...base,reportRevision:0},{...base,source:'untrusted'},
   {...base,pages:[2,1]},{...base,pages:[1,1]},
   {...base,marks:[{...base.marks[0],page:3}]},
   {...base,marks:[{...base.marks[0],surah:null}]},
   {...base,marks:[{...base.marks[1],payload:{color:'#bad',width:3,points:[]}}]},
   {...base,marks:[{...base.marks[1],payload:{color:'#000000',width:3,
      points:[{x:1,y:1},{x:2000,y:2}]}}]}
  ];
  for(const data of bad)
   expect(()=>parsePublishedQuranArchive({archive:data})).toThrow(ArchiveError);
 });
});
