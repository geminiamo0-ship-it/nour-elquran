import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {
  allowStart,allowEnd,allowPageNavigation,allowDrawing,allowErase,allowMicUnmute,
  timeAlerts,visiblePageStrokes,validateAyahError,type ClassroomPreviewState,type SharedInkRecord,
} from './domain';
import {ClassroomPreview} from './ClassroomPreview';

const waiting:ClassroomPreviewState={
  phase:'waiting',teacherPresent:true,learnerPresent:false,studentDrawingAllowed:true,
  studentMicAllowed:true,currentPage:604,
};
const live:ClassroomPreviewState={...waiting,phase:'live',learnerPresent:true};
const marker:SharedInkRecord={
  stroke:{id:'marker',page:604,color:'#ffaa00',width:16,kind:'marker',
    points:[{x:100,y:120},{x:140,y:170}]},
  author:'student',visible:true,operationId:'op-1',page:604,
};
describe('classroom safety and interaction contract',()=>{
  it('blocks Start unless verified teacher AND learner are present',()=>{
    expect(allowStart(waiting,'teacher')).toBe(false);
    expect(allowStart({...waiting,learnerPresent:true},'teacher')).toBe(true);
    expect(allowStart({...waiting,learnerPresent:true},'student')).toBe(false);
    expect(allowStart({...live},'teacher')).toBe(false);
    expect(allowStart({...waiting,teacherPresent:false,learnerPresent:true},'teacher')).toBe(false);
  });
  it('only teacher explicitly ends the active class; disconnect is not End',()=>{
    expect(allowEnd(live,'teacher')).toBe(true);
    expect(allowEnd(live,'student')).toBe(false);
    expect(allowEnd({...live,learnerPresent:false},'teacher')).toBe(true);
    expect(allowEnd(waiting,'teacher')).toBe(false);
    expect(allowEnd({...live,phase:'ended'},'teacher')).toBe(false);
  });
  it('30 and 40 minute thresholds NEVER imply automatic termination',()=>{
    for(const minute of [0,29,30,40,41,60]){
      expect(timeAlerts(minute,'live').autoEnd).toBe(false);
    }
    expect(timeAlerts(30,'live').instructionEnded).toBe(true);
    expect(timeAlerts(30,'live').reservedSlotEnded).toBe(false);
    expect(timeAlerts(40,'live').reservedSlotEnded).toBe(true);
    expect(timeAlerts(41,'live').nextConflict).toBe(true);
    expect(timeAlerts(60,'waiting').reservedSlotEnded).toBe(false);
  });
  it('navigation and shared drawing follow role and teacher pause policy',()=>{
    expect(allowPageNavigation(live,'teacher')).toBe(true);
    expect(allowPageNavigation(live,'student')).toBe(false);
    expect(allowDrawing(live,'student')).toBe(true);
    expect(allowDrawing({...live,studentDrawingAllowed:false},'student')).toBe(false);
    expect(allowDrawing({...live,studentDrawingAllowed:false},'teacher')).toBe(true);
    expect(allowDrawing(waiting,'teacher')).toBe(false);
  });
  it('only teacher may hide other participant marks; student cannot erase teacher marks',()=>{
    const teacherMark={...marker,author:'teacher' as const};
    expect(allowErase(marker,live,'teacher')).toBe(true);
    expect(allowErase(teacherMark,live,'student')).toBe(false);
    expect(allowErase(marker,live,'student')).toBe(true);
    expect(allowErase(marker,{...live,studentDrawingAllowed:false},'student')).toBe(false);
  });
  it('teacher cannot remotely unmute student and student must actively choose',()=>{
    expect(allowMicUnmute(live,'teacher')).toBe(false);
    expect(allowMicUnmute(live,'student')).toBe(true);
    expect(allowMicUnmute({...live,studentMicAllowed:false},'student')).toBe(false);
  });
  it('keeps hidden marks for audit while only displaying page-local visible strokes',()=>{
    expect(visiblePageStrokes([marker,{...marker,visible:false,operationId:'op-2'},
      {...marker,page:603}],604)).toEqual([marker.stroke]);
  });
  it('Quran-linked errors require a verified ayah reference',()=>{
    expect(validateAyahError({page:604,surah:114,ayah:1,wordIndex:null},'tajweed','')).toBe(true);
    expect(validateAyahError({page:0,surah:114,ayah:1,wordIndex:null},'tajweed','')).toBe(false);
    expect(validateAyahError({page:604,surah:114,ayah:0,wordIndex:null},'tajweed','')).toBe(false);
    expect(validateAyahError({page:604,surah:114,ayah:1,wordIndex:null},'tajweed','x'.repeat(501))).toBe(false);
  });
  it('renders original shared Quran with explicit mock-mode and no fake live call',()=>{
    const html=renderToStaticMarkup(<ClassroomPreview/>);
    expect(html).toContain('المصحف المشترك');
    expect(html).toContain('معاينة الفصل التفاعلي فقط');
    expect(html).toContain('بدء الحصة');
    expect(html).toContain('الشيخ موجود');
    expect(html).not.toContain('تم الاتصال بـLiveKit');
  });
});
