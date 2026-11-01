'use client';
import {useStudent} from './StudentContext';
import {ConnectedStudentDashboard} from './ConnectedStudentDashboard';
import {PremiumHome,type HomeTask} from './PremiumHome';

export function StudentDashboard({previewBasePath}:{previewBasePath?:string}={}){
 const {selected}=useStudent();
 const {profile,lessons,tasks,latestReport}=selected;
 if(!profile.demo)return <ConnectedStudentDashboard key={profile.id} learnerId={profile.id} name={profile.name}/>;
 const upcoming=lessons.filter(l=>l.status==='booked'&&l.dayOffset>=0)
  .slice().sort((a,b)=>a.dayOffset-b.dayOffset)[0];
 const previewTasks:HomeTask[]=tasks.map(t=>({id:t.id,label:t.scope,kind:t.kind==='revision'?'مراجعة':t.kind==='recitation'?'تلاوة':'حفظ'}));
 const grades=latestReport?[
  {label:'الحفظ',value:latestReport.memorization===null?'لم يُقيّم':latestReport.memorization+'/10'},
  {label:'التلاوة',value:latestReport.recitation===null?'لم يُقيّم':latestReport.recitation+'/10'},
  {label:'التجويد',value:latestReport.tajweed===null?'لم يُقيّم':latestReport.tajweed+'/10'},
 ]:[];
 const lesson=upcoming?{time:upcoming.dayOffset===0?'اليوم '+upcoming.time:'بعد '+upcoming.dayOffset+' يوم · '+upcoming.time,
  kind:upcoming.kind==='trial'?'حصة تجريبية':'حفظ ومراجعة',href:(previewBasePath??'/student')+'/lessons',action:'عرض الحصص (معاينة)'}:undefined;
 return <PremiumHome name={profile.name} lesson={lesson} tasks={previewTasks} grades={grades} preview basePath={previewBasePath}/>;
}
