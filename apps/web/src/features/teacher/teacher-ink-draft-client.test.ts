import {afterEach,describe,expect,it,vi} from 'vitest';
import {parseTeacherInkDraft,teacherInkDraftClient} from './teacher-ink-draft-client';

const learnerId='child-a';
const foreignId='child-b';
const draftId='2f2f4b92-5700-4e03-bf63-b5a6cdfc73df';
const anotherId='393083fa-9bb3-495a-84e1-2bc938becb2a';
const mark={id:'mk-highlight-0001',kind:'highlight',page:1,surah:1,ayah:1,
 payload:{color:'#d0a94c'}} as const;
const pen={id:'mk-pen-0001',kind:'pen',page:1,surah:null,ayah:null,
 payload:{color:'#d0a94c',width:3,points:[{x:100,y:250},{x:120,y:270}]}} as const;
const assignment={kind:'revision' as const,editionId:'hafs-kfqc:v1.1.1',
 surah:1,fromAyah:1,toAyah:7,dueAtMs:1890000000000,instructions:'Synthetic review'};
const stored={...assignment,draftId,revision:1,learnerId,marks:[mark,pen],
 updatedAtMs:1780000000000};

afterEach(()=>vi.unstubAllGlobals());
describe('Sheikh private draft responses must be bound to the selected learner (#286)',()=>{
 it('accepts only canonical own-learner marked revisions',()=>{
  expect(parseTeacherInkDraft(stored,learnerId)).toEqual(stored);
  expect(()=>parseTeacherInkDraft(stored,foreignId)).toThrow('INVALID_DRAFT_RESPONSE');
  expect(()=>parseTeacherInkDraft({...stored,learnerId:foreignId},learnerId))
   .toThrow('INVALID_DRAFT_RESPONSE');
 });
 it('denies forged IDs, revision, unsafe marks, duplicate marks and extra data',()=>{
  const invalid=[
   {...stored,draftId:'------------------------------------'},
   {...stored,revision:1001},
   {...stored,surah:115},
   {...stored,toAyah:0},
   {...stored,marks:[mark,mark]},
   {...stored,marks:[{...mark,page:605}]},
   {...stored,marks:[{...mark,payload:{color:'red'}}]},
   {...stored,marks:[{...mark,payload:{color:'#d0a94c',secret:'injected'}}]},
   {...stored,marks:[{...pen,payload:{...pen.payload,points:[{x:-1,y:0},{x:1,y:0}]}}]},
   {...stored,marks:[{...pen,surah:1}]},
   {...stored,marks:[{...mark,kind:'note',payload:{color:'#d0a94c'}}]},
   {...stored,marks:[{...mark,kind:'note',payload:{color:'#d0a94c',text:''}}]},
   {...stored,otherStudent:'leak'},
  ];
  for(const raw of invalid){
   expect(()=>parseTeacherInkDraft(raw,learnerId)).toThrow('INVALID_DRAFT_RESPONSE');
  }
 });
 it('rejects a cross-sibling list even if endpoint and status claim success',async()=>{
  const urls:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
   urls.push(String(input));
   expect(init).toMatchObject({credentials:'same-origin',cache:'no-store',redirect:'error'});
   return Response.json({drafts:[stored,{...stored,draftId:anotherId,learnerId:foreignId}]});
  }));
  await expect(teacherInkDraftClient.list(learnerId)).rejects.toMatchObject({
   code:'INVALID_DRAFT_RESPONSE'});
  expect(urls).toEqual(['/v1/teacher/learners/child-a/assignment-drafts']);
 });
 it('rejects duplicate draft IDs returned in list; accepts proper own-only list',async()=>{
  const mock=vi.fn(async()=>Response.json({drafts:[stored,{...stored}]}));
  vi.stubGlobal('fetch',mock);
  await expect(teacherInkDraftClient.list(learnerId)).rejects.toMatchObject({
   code:'INVALID_DRAFT_RESPONSE'});
  mock.mockImplementationOnce(async()=>Response.json({drafts:[stored]}));
  expect(await teacherInkDraftClient.list(learnerId)).toEqual([stored]);
 });
 it('rejects forged ACK for learner, revision, marks, assignment, or draft identity',async()=>{
  const cases=[
   {...stored,learnerId:foreignId},
   {...stored,draftId:anotherId},
   {...stored,revision:2},
   {...stored,marks:[mark]},
   {...stored,instructions:'Changed without consent'},
   {...stored,kind:'recitation'},
  ];
  for(const fake of cases){
   vi.stubGlobal('fetch',vi.fn(async()=>Response.json({code:'DRAFT_SAVED',draft:fake})));
   await expect(teacherInkDraftClient.save(learnerId,assignment,draftId,1,[mark,pen]))
    .rejects.toMatchObject({code:'INVALID_DRAFT_RESPONSE'});
  }
 });
 it('requires exact replay or saved receipt and posts to authorized same-origin path',async()=>{
  const calls:Array<{url:string,init?:RequestInit}>=[];
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
   calls.push({url:String(input),init});
   return Response.json({code:'DRAFT_ALREADY_SAVED',draft:stored},{status:200});
  }));
  expect(await teacherInkDraftClient.save(learnerId,assignment,draftId,1,[mark,pen]))
   .toEqual(stored);
  expect(calls[0]?.url).toBe('/v1/teacher/learners/child-a/assignment-drafts');
  expect(calls[0]?.init).toMatchObject({method:'POST',credentials:'same-origin',
   cache:'no-store',redirect:'error'});
  expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({draftId,revision:1,
   marks:[mark,pen]});
 });
});
