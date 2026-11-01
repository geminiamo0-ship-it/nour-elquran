import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminCollectionPanel} from './AdminCollectionPanel';
import {ADMIN_NAVIGATION,getAdminRoute} from './admin-navigation';

describe('Admin Phase B connected four collections (#307)',()=>{
 const session={user:{id:'verified-staff',name:'Synthetic Verified Staff'},phoneVerified:true};
 for(const view of ['students','schedule','subscriptions','attendance'] as const){
  it('starts '+view+' behind a loading gate, without inventing personal records',()=>{
   const html=renderToStaticMarkup(<AdminCollectionPanel session={session} view={view}/>);
   expect(html).toContain('جارٍ التحقق من صلاحيات الإدارة');
   expect(html).not.toContain('طالب تجريبي');
   expect(html).not.toContain('تم الدفع');
  });
 }
 it('marks only the six confirmed read-only Admin entries as connected',()=>{
  for(const route of ['/admin','/admin/teachers','/admin/students',
   '/admin/schedule','/admin/subscriptions','/admin/attendance']){
   expect(ADMIN_NAVIGATION.find(x=>x.href===route)?.connected).toBe(true);
   expect(getAdminRoute(route+'/')).toBe(route);
  }
  expect(ADMIN_NAVIGATION.find(x=>x.href==='/admin/settings')?.connected).toBe(false);
 });
});
