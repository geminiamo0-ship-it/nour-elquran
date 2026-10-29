import type {ReactNode} from 'react';
import {TeacherShell} from '@/features/teacher';
export default function TeacherLayout({children}:{children:ReactNode}){
  return <TeacherShell>{children}</TeacherShell>;
}
