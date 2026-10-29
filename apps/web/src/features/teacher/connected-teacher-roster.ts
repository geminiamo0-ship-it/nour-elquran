import type {TeacherRosterRow,TeacherCalendarRow} from './teacher-read-api';

export function selectAuthorizedTeacherLearner(
  learners:readonly TeacherRosterRow[], query:string, selectedId:string|null,
){
  const normalized=query.trim().toLocaleLowerCase('ar');
  const shown=learners.filter(row=>row.name.toLocaleLowerCase('ar').includes(normalized));
  return {shown,selected:shown.find(row=>row.id===selectedId)??shown[0]??null};
}

/** Do not expose old learner lessons when the currently assigned roster changes. */
export function currentAuthorizedLearnerLessons(
  selected:TeacherRosterRow|null, lessons:readonly TeacherCalendarRow[],
){
  return selected?lessons.filter(row=>row.learnerId===selected.id):[];
}
