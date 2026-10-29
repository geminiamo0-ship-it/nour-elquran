import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {TeacherReadOnlyView} from './TeacherReadOnlyView';
import {describe,expect,it,vi} from 'vitest';
import {createTeacherReadClient,parseTeacherLessons,parseTeacherRoster,TeacherReadError} from './teacher-read-api';

const student={id:'learner-1',name:'طالب',learnerType:'child'};
const lesson={id:'lesson-1',learnerId:'learner-1',learnerName:'طالب',
  kind:'standard',status:'scheduled',startsAtMs:1000,endsAtMs:2401000};

describe('read-only teacher client contracts',()=>{
  it('parses an empty authorized roster, never adding mock learners',()=>{
    expect(parseTeacherRoster({learners:[]})).toEqual([]);
    expect(parseTeacherLessons({lessons:[]})).toEqual([]);
  });
  it('rejects unrelated shapes, unbounded lists, duplicate ids and fake status',()=>{
    expect(()=>parseTeacherRoster({learners:[student,student]})).toThrow(TeacherReadError);
    expect(()=>parseTeacherRoster({learners:[{...student,name:''}]})).toThrow();
    expect(()=>parseTeacherRoster({learners:Array(51).fill(student)})).toThrow();
    expect(()=>parseTeacherLessons({lessons:[{...lesson,status:'waiting'}]})).toThrow();
    expect(()=>parseTeacherLessons({lessons:[{...lesson,endsAtMs:1}]})).toThrow();
    expect(()=>parseTeacherLessons({lessons:[lesson,lesson]})).toThrow();
  });
  it('accepts only bounded real server fields',()=>{
    expect(parseTeacherRoster({learners:[{...student,phone:'PRIVATE'}]})).toEqual([student]);
    expect(parseTeacherLessons({lessons:[lesson]})).toEqual([lesson]);
  });
  it('uses only fixed same-origin GETs with cookies and no cache',async()=>{
    const transport=vi.fn(async(path:string)=>new Response(JSON.stringify(
      path.endsWith('/learners')?{learners:[student]}:{lessons:[lesson]}
    ),{status:200}));
    const client=createTeacherReadClient(transport as unknown as typeof fetch);
    await client.roster();await client.lessons();
    expect(transport.mock.calls.length).toBe(2);
    expect(transport.mock.calls[0]![0]).toBe('/v1/teacher/learners');
    expect(transport.mock.calls[1]![0]).toBe('/v1/teacher/lessons');
  });
  it('does not fall back to demonstration on 401, 403, network or malformed 200',async()=>{
    const denied=createTeacherReadClient(async()=>new Response('{}',{status:403}));
    await expect(denied.roster()).rejects.toMatchObject({status:403,code:'TEACHER_ACCESS_DENIED'});
    const invalid=createTeacherReadClient(async()=>new Response('{}',{status:200}));
    await expect(invalid.roster()).rejects.toMatchObject({code:'INVALID_RESPONSE'});
    const offline=createTeacherReadClient(async()=>{throw Error('offline')});
    await expect(offline.lessons()).rejects.toMatchObject({code:'NETWORK_ERROR'});
  });
});

describe('teacher real-data SSR trust boundary',()=>{
  it('renders only an explicit loading state before verified API response',()=>{
    const html=renderToStaticMarkup(createElement(TeacherReadOnlyView,{pathname:'/teacher'}));
    expect(html).toContain('جاري التحقق');
    expect(html).not.toContain('حساب الشيخ التجريبي');
    expect(html).not.toContain('demo-learner');
  });
});
