import type { ReactNode } from 'react';
import { StudentShell } from '@/features/student';
export default function StudentLayout({ children }: { children: ReactNode }) {
  return <StudentShell>{children}</StudentShell>;
}
