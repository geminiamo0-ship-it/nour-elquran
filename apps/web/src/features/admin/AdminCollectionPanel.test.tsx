import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminCollectionPanel,adminCollectionReceiptMayShow} from './AdminCollectionPanel';
import {ADMIN_NAVIGATION,getAdminRoute} from './admin-navigation';

describe('Admin Phase B connected four collections (#307)',()=>{
 const session={user:{id:'verified-staff',name:'Synthetic Verified Staff'},phoneVerified:true};
 it('hides old action receipts after a signed staff denial or session switch (#314)',()=>{
  const receipt={session,view:'schedule' as const};
  const sameUserNewSession={...session};
  expect(adminCollectionReceiptMayShow(receipt,session,'schedule',false)).toBe(true);
  expect(adminCollectionReceiptMayShow(receipt,session,'schedule',true)).toBe(false);
  expect(adminCollectionReceiptMayShow(receipt,sameUserNewSession,'schedule',false)).toBe(false);
  expect(adminCollectionReceiptMayShow(receipt,session,'attendance',false)).toBe(false);
  expect(adminCollectionReceiptMayShow(null,session,'schedule',false)).toBe(false);
 });
 for(const view of ['students','schedule','subscriptions','attendance'] as const){
  it('starts '+view+' behind a loading gate, without inventing personal records',()=>{
   const html=renderToStaticMarkup(<AdminCollectionPanel session={session} view={view}/>);
   expect(html).toContain('جارٍ التحقق من صلاحيات الإدارة');
   expect(html).not.toContain('طالب تجريبي');
   expect(html).not.toContain('تم الدفع');
  });
 }
 it('connects verified Academy MVP Admin sections without dead navigation',()=>{
  for(const route of ['/admin','/admin/teachers','/admin/students',
   '/admin/schedule','/admin/subscriptions','/admin/attendance',
   '/admin/packages','/admin/requests','/admin/settings']){
   expect(ADMIN_NAVIGATION.find(x=>x.href===route)?.connected).toBe(true);
   expect(getAdminRoute(route+'/')).toBe(route);
  }
 });
});
