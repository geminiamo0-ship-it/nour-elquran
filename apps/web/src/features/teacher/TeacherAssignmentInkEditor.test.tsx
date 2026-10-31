import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {TeacherAssignmentInkEditor,inkEditorExitDecision} from './TeacherAssignmentInkEditor';

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
