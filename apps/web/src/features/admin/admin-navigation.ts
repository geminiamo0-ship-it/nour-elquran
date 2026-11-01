/** #302: only admin landing is connected in Phase A.
 * These links are navigation to clearly labelled, non-actionable sections.
 */
export const ADMIN_NAVIGATION=[
 {href:'/admin',label:'الرئيسية',short:'لوحة المتابعة',symbol:'⌂',connected:true},
 {href:'/admin/students',label:'الطلاب والأسر',short:'الطلاب',symbol:'♙',connected:false},
 {href:'/admin/teachers',label:'الشيوخ',short:'الشيوخ',symbol:'♧',connected:false},
 {href:'/admin/schedule',label:'الحصص والجدول',short:'الحصص',symbol:'▦',connected:false},
 {href:'/admin/subscriptions',label:'الاشتراكات',short:'الاشتراكات',symbol:'◈',connected:false},
 {href:'/admin/attendance',label:'الحضور والتعويضات',short:'الحضور',symbol:'◷',connected:false},
 {href:'/admin/settings',label:'الإعدادات',short:'الإعدادات',symbol:'⚙',connected:false},
] as const;
export type AdminRoute=typeof ADMIN_NAVIGATION[number]['href'];
export function getAdminRoute(pathname:string):AdminRoute{
 const path=pathname.replace(/\/+$/,'')||'/';
 return ADMIN_NAVIGATION.find(n=>n.href===path)?.href??'/admin';
}
