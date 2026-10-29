import {notFound} from 'next/navigation';
import {TeacherSection,teacherSections,TEACHER_SECTION_SLUGS,type TeacherSectionName} from '@/features/teacher';
export function generateStaticParams(){
  return TEACHER_SECTION_SLUGS.map(section=>({section}));
}
export default async function TeacherSubpage({params}:{params:Promise<{section:string}>}){
  const {section}=await params;
  if(!Object.hasOwn(teacherSections,section))notFound();
  return <TeacherSection section={section as TeacherSectionName}/>;
}
