import {TeacherStudents} from './TeacherStudents';
import {TeacherSchedule} from './TeacherSchedule';
import {TeacherPreparation} from './TeacherPreparation';
import {TeacherReports} from './TeacherReports';
import {TeacherAssignments} from './TeacherAssignments';
import {TeacherNotifications} from './TeacherNotifications';
import {TeacherCases} from './TeacherCases';
import type {TeacherSectionName} from './domain';

export function TeacherSection({section}:{section:TeacherSectionName}){
  switch(section){
    case 'students':return <TeacherStudents/>;
    case 'schedule':return <TeacherSchedule/>;
    case 'preparation':return <TeacherPreparation/>;
    case 'reports':return <TeacherReports/>;
    case 'assignments':return <TeacherAssignments/>;
    case 'notifications':return <TeacherNotifications/>;
    case 'cases':return <TeacherCases/>;
  }
}
