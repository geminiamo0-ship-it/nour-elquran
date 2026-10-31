import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {TeacherAssignmentInkEditor,inkEditorExitDecision,
 inkEditorCanPublish,inkEditorCanSave} from './TeacherAssignmentInkEditor';

const initial={
 kind:'memorization' as const,
 editionId:'hafs-kfqc:v1.1.1',surah:1,fromAyah:1,toAyah:5,
 dueAtMs:Date.now()+86400000,
 instructions:'Synthetic review; no child information',
};
describe('private Sheikh Quran marks must not be silently discarded',()=>{
 it('requires confirmation for dirty marks; prevents close during a write',()=>{
  expect(inkEditorExitDecision(true,false)).toBe('confirm');
  expect(inkEditorExitDecision(false,false)).toBe('close');
  expect(inkEditorExitDecision(true,true)).toBe('blocked');
  expect(inkEditorExitDecision(false,true)).toBe('blocked');
 });
 it('a typed but unattached Sheikh note blocks save/publish and requires exit confirmation',()=>{
  expect(inkEditorExitDecision(false,false,true)).toBe('confirm');
  expect(inkEditorExitDecision(true,false,true)).toBe('confirm');
  expect(inkEditorExitDecision(false,true,true)).toBe('blocked');
  // A previously saved draft is NOT publishable while an unattached note
  // is present; the note was never serialized into the D1 marks array.
  expect(inkEditorCanPublish(false,false,true,true)).toBe(false);
  expect(inkEditorCanPublish(false,false,false,true)).toBe(true);
  expect(inkEditorCanPublish(false,true,false,true)).toBe(false);
  expect(inkEditorCanPublish(true,false,false,true)).toBe(false);
  expect(inkEditorCanPublish(false,false,false,false)).toBe(false);
  expect(inkEditorCanSave(true,false,true)).toBe(false);
  expect(inkEditorCanSave(true,false,false)).toBe(true);
  expect(inkEditorCanSave(true,true,false)).toBe(false);
  expect(inkEditorCanSave(false,false,false)).toBe(false);
 });
 it('allows safe exit from an already saved private draft while range reloads',()=>{
  const existing={...initial,draftId:'32a8e27c-400a-4cfe-aee7-81bf2895bdeb',
   learnerId:'synthetic-learner',revision:1,marks:[],updatedAtMs:0};
  const html=renderToStaticMarkup(<TeacherAssignmentInkEditor
   learnerId="synthetic-learner" initial={initial} existing={existing}
   onSaved={()=>undefined} onPublished={()=>undefined} onCancel={()=>undefined}/>);
  expect(html).toContain('جارٍ التحقق من نطاق المصحف المعتمد');
  expect(html).toContain('إغلاق المحرر');
  expect(html).not.toContain('تجاهل التغييرات وإغلاق المحرر');
 });
 it('shows a safe close even when authorized page range is still loading',()=>{
  const html=renderToStaticMarkup(<TeacherAssignmentInkEditor
   learnerId="synthetic-learner" initial={initial} onSaved={()=>undefined}
   onPublished={()=>undefined} onCancel={()=>undefined}/>);
  expect(html).toContain('جارٍ التحقق من نطاق المصحف المعتمد');
  expect(html).toContain('إغلاق المحرر');
  expect(html).toContain('مسودة خاصة بالشيخ حتى النشر');
  expect(html).not.toContain('نُشر الواجب والعلامات');
 });
});
