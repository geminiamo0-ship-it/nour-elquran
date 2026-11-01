import {notFound} from 'next/navigation';
import {StudentSection} from '@/features/student/StudentSection';
const allowed=['lessons','training','mushaf'] as const;
export function generateStaticParams(){
 return allowed.map(section=>({section}));
}
export default async function StudentDesignPreviewSection({params}:{params:Promise<{section:string}>}){
 const {section}=await params;
 if(section!=='lessons'&&section!=='training'&&section!=='mushaf')notFound();
 return <StudentSection section={section}/>;
}
