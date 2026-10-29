'use client';
import {createContext,useContext,useMemo,useState,type ReactNode} from 'react';
import {
  canEditLearnerPlan,canReportStudentAbsent,validAssignment,validReport,
  type TeacherLearner,type TeacherLesson,type TeacherAssignment,type LessonReport,
  type TeacherIncident,type TeacherNotice,type AssignmentInput,type Scenario,
} from './domain';
import {DEMO_ASSIGNMENTS,DEMO_NOTICES,DEMO_REPORTS,demoScenario} from './fixtures';

type TeacherContextValue = {
  scenario:Scenario;setScenario:(value:Scenario)=>void;
  lessons:readonly TeacherLesson[]; learners:readonly TeacherLearner[];
  reports:readonly LessonReport[]; assignments:readonly TeacherAssignment[];
  notices:readonly TeacherNotice[]; incidents:readonly TeacherIncident[];
  selectedLearnerId:string|null;setSelectedLearnerId:(id:string|null)=>void;
  selectedLessonId:string|null;setSelectedLessonId:(id:string|null)=>void;
  note:string;clearNote:()=>void;
  updatePlan:(id:string,revision:string,wird:string)=>boolean;
  updateReport:(id:string,patch:Partial<Pick<LessonReport,'scope'|'strengths'|'corrections'|'nextPlan'|'hifz'|'recitation'|'tajweed'>>)=>boolean;
  publishReport:(id:string)=>boolean;
  reopenReport:(id:string)=>boolean;
  createAssignment:(draft:AssignmentInput)=>boolean;
  reviewSubmission:(assignmentId:string,feedback:string,retry:boolean)=>boolean;
  markNotice:(id:string)=>void;
  reportNoShow:(lessonId:string)=>boolean;
};
const TeacherContext=createContext<TeacherContextValue|null>(null);
export function useTeacher():TeacherContextValue {
  const value=useContext(TeacherContext);
  if(!value)throw new Error('TeacherProvider is required');
  return value;
}
export function TeacherProvider({children}:{children:ReactNode}) {
  const [scenario,setScenarioState]=useState<Scenario>('normal');
  const [localLearners,setLocalLearners]=useState<TeacherLearner[]|null>(null);
  const [localReports,setLocalReports]=useState<LessonReport[]|null>(null);
  const [localAssignments,setLocalAssignments]=useState<TeacherAssignment[]|null>(null);
  const [localNotices,setLocalNotices]=useState<TeacherNotice[]|null>(null);
  const [localIncidents,setLocalIncidents]=useState<TeacherIncident[]|null>(null);
  const [selectedLearnerId,setSelectedLearnerId]=useState<string|null>(null);
  const [selectedLessonId,setSelectedLessonId]=useState<string|null>(null);
  const [note,setNote]=useState('');
  const example=useMemo(()=>demoScenario(scenario),[scenario]);
  const lessons=example.lessons;
  const learners=localLearners??example.learners;
  const reports=localReports??(scenario==='empty'?[]:DEMO_REPORTS);
  const assignments=localAssignments??(scenario==='empty'?[]:DEMO_ASSIGNMENTS);
  const notices=localNotices??(scenario==='empty'?[]:DEMO_NOTICES);
  const incidents=localIncidents??example.incidents;
  function feedback(message:string){setNote(message);}
  function setScenario(next:Scenario){
    setScenarioState(next);setLocalLearners(null);setLocalReports(null);
    setLocalAssignments(null);setLocalNotices(null);setLocalIncidents(null);
    setSelectedLearnerId(null);setSelectedLessonId(null);setNote('');
  }
  function updatePlan(id:string,revision:string,wird:string) {
    const learner=learners.find(x=>x.id===id);
    if(!learner||!canEditLearnerPlan(learner)||!revision.trim()||!wird.trim()||revision.length>500||wird.length>300)return false;
    setLocalLearners(learners.map(x=>x.id===id?{...x,revision:revision.trim(),nextWird:wird.trim()}:x));
    feedback('حُفظت خطة العرض محليًا؛ في التطبيق الفعلي تحتاج Revision وسجل تعديل خادمي.');
    return true;
  }
  function updateReport(id:string,patch:Partial<Pick<LessonReport,'scope'|'strengths'|'corrections'|'nextPlan'|'hifz'|'recitation'|'tajweed'>>) {
    const report=reports.find(r=>r.id===id);
    if(!report||report.status!=='draft')return false;
    const candidate={...report,...patch};
    if(!validReport(candidate))return false;
    setLocalReports(reports.map(r=>r.id===id?candidate:r));
    feedback('تعديلات التقرير محفوظة داخل المعاينة فقط، ولم تُنشر للطالب.');
    return true;
  }
  function publishReport(id:string) {
    const report=reports.find(r=>r.id===id);
    if(!report||report.status!=='draft'||!validReport(report)||!report.scope.trim())return false;
    setLocalReports(reports.map(r=>r.id===id?{
      ...r,status:'published',publishedRevision:r.revision,
    }:r));
    feedback('نشر تجريبي داخل المعاينة فقط؛ لم يصل شيء إلى أي طالب.');
    return true;
  }
  function reopenReport(id:string) {
    const report=reports.find(r=>r.id===id);
    if(!report||report.status!=='published')return false;
    // Only opens a NEW editable revision; historical publication remains separate.
    setLocalReports(reports.map(r=>r.id===id?{
      ...r,status:'draft',revision:r.revision+1,
    }:r));
    feedback('تم فتح مسودة تصحيح تجريبية، ويبقى الإصدار المنشور السابق كما هو حتى الاعتماد.');
    return true;
  }
  function createAssignment(draft:AssignmentInput) {
    if(!validAssignment(draft,learners))return false;
    const timestamp=Date.now().toString(36);
    setLocalAssignments([
      ...draft.learnerIds.map((learnerId,i):TeacherAssignment=>({
        id:`local-${timestamp}-${i}`,learnerId,kind:draft.kind,surah:draft.surah,
        surahName:draft.surahName,fromAyah:draft.fromAyah,toAyah:draft.toAyah,
        dueDate:draft.dueDate,status:'assigned',attempt:0,feedback:'',
      })),...assignments,
    ]);
    feedback('أُضيفت الواجبات التجريبية لكل طالب بشكل مستقل؛ لم تُرسل أو تُنشر على الخادم.');
    return true;
  }
  function reviewSubmission(assignmentId:string,feedbackText:string,retry:boolean){
    const target=assignments.find(a=>a.id===assignmentId);
    if(!target||target.status!=='awaiting-review'||!feedbackText.trim()||feedbackText.length>500)return false;
    setLocalAssignments(assignments.map(a=>a.id===assignmentId?{
      ...a,status:retry?'retry-requested':'completed',feedback:feedbackText.trim(),
    }:a));
    feedback('تم حفظ التصحيح داخل المعاينة. النسخة الحقيقية ستحتاج حفظ محاولة الصوت الأصلية.');
    return true;
  }
  function markNotice(id:string){
    setLocalNotices(notices.map(n=>n.id===id?{...n,read:true}:n));
  }
  function reportNoShow(lessonId:string){
    const lesson=lessons.find(l=>l.id===lessonId);
    if(!lesson||!canReportStudentAbsent(lesson)||incidents.some(c=>c.lessonId===lessonId&&c.kind==='student-absence'&&c.status==='pending'))return false;
    setLocalIncidents([...incidents,{id:'local-absence-'+lessonId,lessonId,kind:'student-absence',label:'بلاغ غياب مبدئي',
      detail:'يتحقق فريق الإدارة من ظروف التأخر، ولا يُخصم رصيد تلقائيًا. يمكن للشيخ بدء الحصة إذا حضر الطالب لاحقًا.',status:'pending'}]);
    feedback('سُجل بلاغ معاينة مبدئي؛ لا خصم أو قرار إداري أو إشعار حقيقي.');
    return true;
  }
  return <TeacherContext.Provider value={{
    scenario,setScenario,lessons,learners,reports,assignments,notices,incidents,
    selectedLearnerId,setSelectedLearnerId,selectedLessonId,setSelectedLessonId,
    note,clearNote:()=>setNote(''),updatePlan,updateReport,publishReport,reopenReport,
    createAssignment,reviewSubmission,markNotice,reportNoShow,
  }}>{children}</TeacherContext.Provider>;
}
