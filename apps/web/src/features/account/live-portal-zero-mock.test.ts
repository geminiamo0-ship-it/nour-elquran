import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
function source(path:string){
 return readFileSync(new URL(path,import.meta.url),'utf8');
}
describe('canonical live student and Sheikh zero-mock boundary',()=>{
 const teacherShell=source('../teacher/TeacherShell.tsx');
 const teacherHome=source('../../app/teacher/page.tsx');
 const teacherSection=source('../../app/teacher/[section]/page.tsx');
 const studentShell=source('../student/StudentShell.tsx');
 const studentDashboard=source('../student/ConnectedStudentDashboard.tsx');
 const subscription=source('../student/components/SubscriptionWorkspace.tsx');
 it('does not mount TeacherProvider fixtures or anonymous demo pages',()=>{
  expect(teacherShell).not.toMatch(/import\s+.*TeacherProvider/);
  expect(teacherShell).not.toMatch(/useTeacher\(|SCENARIOS|scenarioPicker/);
  expect(teacherShell).toContain('TeacherReadOnlyView');
  expect(teacherHome).not.toMatch(/TeacherHome/);
  expect(teacherSection).not.toMatch(/<TeacherSection/);
 });
 it('must not route authenticated Sheikh to the public classroom demo',()=>{
  expect(teacherShell).not.toMatch(/href:\s*['"]\/classroom['"]/);
  expect(source('../teacher/TeacherReadOnlyView.tsx')).toContain('/classroom/live?role=teacher');
 });
 it('fails closed when student account backend is disabled',()=>{
  expect(studentShell).toContain('ACCOUNT_UI_ENABLED ? <ConnectedStudentShell>');
  expect(studentShell).toContain(': <AccountGate/>');
  expect(studentShell).not.toMatch(/: <StudentProvider><Frame>/);
 });
 it('shows only real owner-bound home data and never inferred finance status',()=>{
  for(const api of ['notebookClient.lessons','tasksClient.owner','lessonReportsClient.student'])
   expect(studentDashboard).toContain(api);
  expect(studentDashboard).not.toContain('DEMO_PROFILES');
  expect(studentDashboard).not.toContain('getMockLearnerSnapshot');
  expect(subscription).not.toMatch(/stageCopy|بدون اشتراك|نشط في بيانات التجربة/);
 });
});
