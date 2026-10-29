/** Classroom UI preview policy. Server-authoritative rules live in Workers + LessonDO.
 * This module NEVER authenticates a role or replaces the two-person presence check.
 */
import type {QuranInkStroke,QuranTarget} from '@/features/student';
export type ViewRole='teacher'|'student';
export type ClassroomPhase='waiting'|'live'|'ended';
export type ErrorKind='memorization'|'tajweed'|'pronunciation'|'repeat';
export type ClassroomTool='off'|'pen'|'marker'|'eraser';
export interface ClassroomPreviewState {
  phase:ClassroomPhase;
  teacherPresent:boolean;
  learnerPresent:boolean;
  studentDrawingAllowed:boolean;
  studentMicAllowed:boolean;
  currentPage:number;
}
export interface SharedInkRecord {
  readonly stroke:QuranInkStroke;readonly author:ViewRole;readonly visible:boolean;
  readonly operationId:string;readonly page:number;
}
export interface TeacherAyahError {
  readonly id:string;readonly target:QuranTarget;readonly kind:ErrorKind;
  readonly note:string;readonly actor:'teacher';readonly createdAt:string;
}
export type AuditAction='stroke-created'|'stroke-hidden'|'student-drawing-paused'|
'student-drawing-resumed'|'page-changed'|'ayah-error-added'|'teacher-started'|'teacher-ended';
export interface ClassroomAuditEntry {
  readonly id:string;readonly actor:ViewRole;readonly action:AuditAction;
  readonly summary:string;readonly at:string;
}
export const ERROR_LABEL:Readonly<Record<ErrorKind,string>>={
  memorization:'خطأ حفظ',tajweed:'حكم تجويد',pronunciation:'نطق/مخرج',repeat:'إعادة تسميع',
};
export function allowStart(state:ClassroomPreviewState,role:ViewRole):boolean {
  return role==='teacher' && state.phase==='waiting'&&state.teacherPresent&&state.learnerPresent;
}
export function allowEnd(state:ClassroomPreviewState,role:ViewRole):boolean {
  return role==='teacher' && state.phase==='live';
}
export function allowPageNavigation(state:ClassroomPreviewState,role:ViewRole):boolean {
  return role==='teacher' && state.phase==='live';
}
export function allowDrawing(state:ClassroomPreviewState,role:ViewRole):boolean {
  return state.phase==='live' && (role==='teacher'||state.studentDrawingAllowed);
}
export function allowErase(record:SharedInkRecord,state:ClassroomPreviewState,role:ViewRole):boolean {
  return allowDrawing(state,role) && (role==='teacher'||record.author==='student');
}
export function allowMicUnmute(state:ClassroomPreviewState,role:ViewRole):boolean {
  // Teacher is never able to turn the student's microphone on remotely.
  return role==='student' && state.studentMicAllowed;
}
export function timeAlerts(elapsedMinutes:number,phase:ClassroomPhase):{
  instructionEnded:boolean;reservedSlotEnded:boolean;nextConflict:boolean;autoEnd:false;
} {
  const elapsed=Number.isFinite(elapsedMinutes)&&elapsedMinutes>=0?elapsedMinutes:0;
  return {instructionEnded:phase==='live'&&elapsed>=30,
    reservedSlotEnded:phase==='live'&&elapsed>=40,
    nextConflict:phase==='live'&&elapsed>40,
    autoEnd:false};
}
export function visiblePageStrokes(records:readonly SharedInkRecord[],page:number):QuranInkStroke[]{
  return records.filter(r=>r.visible&&r.page===page).map(r=>r.stroke);
}
export function validateAyahError(target:QuranTarget|null,kind:ErrorKind,note:string):boolean {
  return !!target&&Number.isInteger(target.page)&&target.page>=1&&target.page<=604
    &&Number.isInteger(target.surah)&&target.surah>=1&&target.surah<=114
    &&Number.isInteger(target.ayah)&&target.ayah>=1
    &&(target.wordIndex===null||(Number.isInteger(target.wordIndex)&&target.wordIndex>0))
    &&Object.hasOwn(ERROR_LABEL,kind)&&note.length<=500;
}
