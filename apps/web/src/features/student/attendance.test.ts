import { describe,expect,it } from 'vitest';
import { APPEAL_WINDOW_MS,attendanceCounts,appealDeadline,canOpenAppeal,currentAttendance,getDemoAttendance,validateEvidence,type AttendanceRecord } from './attendance';
const example=(overrides:Partial<AttendanceRecord>={}):AttendanceRecord=>({
  id:'test-1',learnerId:'a',lessonId:'lesson-1',lessonTitle:'test',lessonAt:'2026-10-21T12:00:00Z',
  recordedAt:'2026-10-22T12:00:00Z',updatedAt:'2026-10-22T12:00:00Z',
  status:'absent',reason:null,appealStatus:null,...overrides,
});
describe('attendance + appeals domain policy',()=>{
  it('opens appeal at recorded time and through exact seven-day boundary',()=>{
    const row=example(); const begin=new Date('2026-10-22T12:00:00Z');
    expect(canOpenAppeal(row,new Date(begin.getTime()-1))).toBe(false);
    expect(canOpenAppeal(row,begin)).toBe(true);
    expect(appealDeadline(row)).toBe(begin.getTime()+APPEAL_WINDOW_MS);
    expect(canOpenAppeal(row,new Date(begin.getTime()+APPEAL_WINDOW_MS))).toBe(true);
    expect(canOpenAppeal(row,new Date(begin.getTime()+APPEAL_WINDOW_MS+1))).toBe(false);
  });
  it('requires confirmed absence without an already open appeal',()=>{
    expect(canOpenAppeal(example({status:'pending'}),new Date('2026-10-23T12:00:00Z'))).toBe(false);
    expect(canOpenAppeal(example({recordedAt:null}),new Date('2026-10-23T12:00:00Z'))).toBe(false);
    expect(canOpenAppeal(example({appealStatus:'under_review'}),new Date('2026-10-23T12:00:00Z'))).toBe(false);
  });
  it('does not count canceled/rescheduled or pending as student absences; dedup per lesson',()=>{
    const rows=currentAttendance([
      example({status:'absent',updatedAt:'2026-10-21T12:00:00Z'}),
      example({id:'new',status:'attended',updatedAt:'2026-10-23T12:00:00Z'}),
      example({id:'c',lessonId:'lesson-2',status:'cancelled'}),
      example({id:'r',lessonId:'lesson-3',status:'rescheduled'}),
      example({id:'p',lessonId:'lesson-4',status:'pending'}),
      example({id:'other',learnerId:'b',lessonId:'lesson-5'}),
    ],'a');
    expect(rows).toHaveLength(4);
    expect(attendanceCounts(rows)).toEqual({attended:1,absent:0,cancelled:1,rescheduled:1,pending:1});
  });
  it('separates fictitious sibling data and validates attachments without reading bytes',()=>{
    expect(getDemoAttendance('demo-new')).toEqual([]);
    expect(getDemoAttendance('demo-active')).toHaveLength(6);
    expect(validateEvidence(null)).toBeNull();
    expect(validateEvidence({type:'image/png',size:5*1024*1024})).toBeNull();
    expect(validateEvidence({type:'application/x-msdownload',size:30})).not.toBeNull();
    expect(validateEvidence({type:'application/pdf',size:5*1024*1024+1})).not.toBeNull();
  });
});
