/** #302/#305: landing and role-scoped teacher directory are connected.
 * These links are navigation to clearly labelled, non-actionable sections.
 */
export const ADMIN_NAVIGATION=[
 {href:'/admin',label:'الرئيسية',short:'لوحة المتابعة',symbol:'⌂',connected:true},
 {href:'/admin/students',label:'الطلاب والأسر',short:'الطلاب',symbol:'♙',connected:true},
 {href:'/admin/teachers',label:'الشيوخ',short:'الشيوخ',symbol:'♧',connected:true},
 {href:'/admin/schedule',label:'الحصص والجدول',short:'الحصص',symbol:'▦',connected:true},
 {href:'/admin/packages',label:'الباقات والأسعار',short:'الباقات',symbol:'◇',connected:true},
 {href:'/admin/requests',label:'طلبات الاشتراك',short:'الطلبات',symbol:'✉',connected:true},
 {href:'/admin/subscriptions',label:'سجل الاشتراكات',short:'الاشتراكات',symbol:'◈',connected:true},
 {href:'/admin/attendance',label:'الحضور والتعويضات',short:'الحضور',symbol:'◷',connected:true},
 {href:'/admin/settings',label:'إعدادات واتساب',short:'الإعدادات',symbol:'⚙',connected:true},
] as const;
export type AdminRoute=typeof ADMIN_NAVIGATION[number]['href'];
export function getAdminRoute(pathname:string):AdminRoute{
 const path=pathname.replace(/\/+$/,'')||'/';
 return ADMIN_NAVIGATION.find(n=>n.href===path)?.href??'/admin';
}
