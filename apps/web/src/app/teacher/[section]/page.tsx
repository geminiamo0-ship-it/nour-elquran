import {notFound} from 'next/navigation';
import {teacherSections,TEACHER_SECTION_SLUGS} from '@/features/teacher';
export function generateStaticParams(){
 return TEACHER_SECTION_SLUGS.map(section=>({section}));
}
export default async function TeacherSubpage({params}:{
 params:Promise<{section:string}>
}){
 const {section}=await params;
 if(!Object.hasOwn(teacherSections,section))notFound();
 // Never render standalone fixture-backed TeacherSection under the live route.
 return null;
}
