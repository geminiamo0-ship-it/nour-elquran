import type {ReactNode} from 'react';
import {StudentPreviewShell} from '@/features/student';
/** Isolated visual preview; the real /student route remains fully signed. */
export default function StudentDesignPreviewLayout({children}:{children:ReactNode}){
 return <StudentPreviewShell>{children}</StudentPreviewShell>;
}
