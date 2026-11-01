import type {ReactNode} from 'react';
import {AdminShell} from '@/features/admin';
/** No per-page fixture content; authenticated shell owns protected UI. */
export default function AdminLayout({children}:{children:ReactNode}){
 void children;
 return <AdminShell/>;
}
