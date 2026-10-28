import { notFound } from 'next/navigation';
import { StudentSection, sections, STUDENT_SECTION_SLUGS, type StudentSectionName } from '@/features/student';
export function generateStaticParams() {
  return STUDENT_SECTION_SLUGS.map((section) => ({ section }));
}
export default async function StudentSubpage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!Object.hasOwn(sections, section)) notFound();
  return <StudentSection section={section as StudentSectionName} />;
}
