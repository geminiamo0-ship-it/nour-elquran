'use client';
import {useState} from 'react';
import type {QuranInkStroke,QuranTarget} from '@/features/student';
import {clampQuranPage} from '@/features/student';
import {
  allowStart,allowEnd,allowPageNavigation,allowDrawing,allowErase,allowMicUnmute,
  visiblePageStrokes,validateAyahError,timeAlerts,
  type ViewRole,type ClassroomPreviewState,type ClassroomTool,
  type SharedInkRecord,type TeacherAyahError,type ErrorKind,type ClassroomAuditEntry,type AuditAction,
} from './domain';

export function useClassroomPreview(){
  const [role,setRole]=useState<ViewRole>('teacher');
  const [room,setRoom]=useState<ClassroomPreviewState>({
    phase:'waiting',teacherPresent:true,learnerPresent:false,
    studentDrawingAllowed:true,studentMicAllowed:true,currentPage:604,
  });
  const [elapsed,setElapsed]=useState(9);
  const [records,setRecords]=useState<SharedInkRecord[]>([]);
  const [errors,setErrors]=useState<TeacherAyahError[]>([]);
  const [audit,setAudit]=useState<ClassroomAuditEntry[]>([]);
  const [target,setTarget]=useState<QuranTarget|null>(null);
  const [inkMode,setInkMode]=useState<ClassroomTool>('off');
  const [inkColor,setInkColor]=useState('#d4ab4c');
  const [teacherMic,setTeacherMic]=useState(true);
  const [studentMicOn,setStudentMicOn]=useState(false);
  const [teacherCamera,setTeacherCamera]=useState(true);
  const [selfPreview,setSelfPreview]=useState(true);
  const [notes,setNotes]=useState('');
  const [scores,setScores]=useState<{hifz:number|null;recitation:number|null;tajweed:number|null}>({
    hifz:null,recitation:null,tajweed:null,
  });
  const isTeacher=role==='teacher';
  const alerts=timeAlerts(elapsed,room.phase);
  function recordAudit(actor:ViewRole,action:AuditAction,summary:string){
    setAudit(previous=>[{id:crypto.randomUUID(),actor,action,summary,at:new Date().toISOString()},...previous].slice(0,150));
  }
  function updatePresence(who:'teacher'|'student',present:boolean){
    setRoom(v=>({...v,[who==='teacher'?'teacherPresent':'learnerPresent']:present}));
    if(who==='student'&&!present)setStudentMicOn(false);
    // Disconnect changes presence only, never phase to ended.
  }
  function start(){
    if(!allowStart(room,role))return false;
    setRoom(v=>({...v,phase:'live'}));
    recordAudit('teacher','teacher-started','بدء الحصة بمحاكاة وجود الطرفين');
    return true;
  }
  function end(){
    if(!allowEnd(room,role))return false;
    setRoom(v=>({...v,phase:'ended'}));setInkMode('off');
    recordAudit('teacher','teacher-ended','أنهى الشيخ الحصة يدويًا في المعاينة');
    return true;
  }
  function setPage(page:number){
    if(!allowPageNavigation(room,role))return false;
    const next=clampQuranPage(page);
    if(next===room.currentPage)return false;
    setRoom(v=>({...v,currentPage:next}));
    setInkMode('off');setTarget(null);
    recordAudit('teacher','page-changed','تغيير الصفحة المشتركة إلى '+next);
    return true;
  }
  function setDrawingAllowed(allowed:boolean){
    if(!isTeacher||room.phase!=='live')return;
    setRoom(v=>({...v,studentDrawingAllowed:allowed}));
    recordAudit('teacher',allowed?'student-drawing-resumed':'student-drawing-paused',
      allowed?'سمح الشيخ بالرسم المشترك':'أوقف الشيخ الرسم المشترك للطالب');
  }
  function setMicAllowed(allowed:boolean){
    if(!isTeacher||room.phase!=='live')return;
    setRoom(v=>({...v,studentMicAllowed:allowed}));
    if(!allowed)setStudentMicOn(false);
    // Reactivating permission never remotely enables the student's microphone.
  }
  function setStudentMicrophone(on:boolean){
    if(role!=='student'||room.phase!=='live')return;
    if(on&&!allowMicUnmute(room,role))return;
    setStudentMicOn(on);
  }
  function setTeacherMicrophone(on:boolean){
    if(!isTeacher||room.phase!=='live')return;
    setTeacherMic(on);
  }
  function updateInk(page:number,next:QuranInkStroke[]){
    if(page!==room.currentPage||!allowDrawing(room,role))return;
    const current=visiblePageStrokes(records,page);
    const currentIds=new Set(current.map(s=>s.id));
    const nextIds=new Set(next.map(s=>s.id));
    const removed=records.filter(r=>r.page===page&&r.visible&&currentIds.has(r.stroke.id)&&!nextIds.has(r.stroke.id)
      &&allowErase(r,room,role));
    const added=next.filter(s=>!currentIds.has(s.id)&&s.page===page);
    if(!removed.length&&!added.length)return;
    const removedIds=new Set(removed.map(r=>r.stroke.id));
    setRecords(prev=>[
      ...prev.map(r=>removedIds.has(r.stroke.id)?{...r,visible:false}:r),
      ...added.map(s=>({stroke:s,author:role,visible:true,operationId:crypto.randomUUID(),page})),
    ]);
    for(const r of removed)recordAudit(role,'stroke-hidden',
      (r.author==='student'?'إخفاء رسم الطالب المشترك':'إخفاء رسم الشيخ المشترك')+' · صفحة '+page);
    if(added.length)recordAudit(role,'stroke-created','رسمة مشتركة جديدة · صفحة '+page+' · '+role);
  }
  function hideStroke(id:string){
    if(!isTeacher||room.phase!=='live')return;
    const match=records.find(r=>r.stroke.id===id&&r.visible);
    if(!match)return;
    setRecords(prev=>prev.map(r=>r.stroke.id===id?{...r,visible:false}:r));
    recordAudit('teacher','stroke-hidden','إخفاء علامة مشتركة بواسطة الشيخ مع حفظ أثر العملية');
  }
  function addError(kind:ErrorKind,note:string){
    if(!isTeacher||room.phase!=='live'||!validateAyahError(target,kind,note))return false;
    const error:TeacherAyahError={
      id:crypto.randomUUID(),target:target!,kind,note:note.trim().slice(0,500),
      actor:'teacher',createdAt:new Date().toISOString(),
    };
    setErrors(v=>[error,...v]);
    recordAudit('teacher','ayah-error-added','تصحيح متعلق بالآية '+error.target.surah+':'+error.target.ayah);
    return true;
  }
  function grade(key:'hifz'|'recitation'|'tajweed',value:number|null){
    if(!isTeacher||room.phase==='waiting'||(value!==null&&(!Number.isInteger(value)||value<0||value>10)))return;
    setScores(v=>({...v,[key]:value}));
  }
  function changeNotes(value:string){
    if(isTeacher&&room.phase!=='waiting')setNotes(value.slice(0,1000));
  }
  return {
    role,setRole,room,elapsed,setElapsed,records,errors,audit,target,setTarget,
    inkMode,setInkMode,inkColor,setInkColor,teacherMic,studentMicOn,teacherCamera,setTeacherCamera,
    selfPreview,setSelfPreview,notes,scores,alerts,isTeacher,
    pageStrokes:visiblePageStrokes(records,room.currentPage),
    updatePresence,start,end,setPage,setDrawingAllowed,setMicAllowed,
    setStudentMicrophone,setTeacherMicrophone,updateInk,hideStroke,addError,grade,changeNotes,
    drawingAvailable:allowDrawing(room,role),
  };
}
export type ClassroomPreviewModel=ReturnType<typeof useClassroomPreview>;
