import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminCollectionPanel,adminCollectionReceiptMayShow,adminCollectionCurrentRead} from './AdminCollectionPanel';
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
 it('hides a stale signed collection immediately on refresh or staff revocation (#314)',()=>{
  const data={view:'schedule' as const,asOfMs:1793600000000,
   rows:[{id:'lesson-1',startsAtMs:1793600000000,kind:'trial',
    status:'scheduled',learnerName:'Synthetic learner',teacherName:'Synthetic teacher'}],
   truncated:false};
  const old={phase:'ready' as const,session,view:'schedule' as const,
   revision:0,data};
  expect(adminCollectionCurrentRead(old,session,'schedule',0)).toEqual(data);
  // A new refresh or post-ACK invalidates the old action target synchronously,
  // even before effect cleanup or the next network response.
  expect(adminCollectionCurrentRead(old,session,'schedule',1)).toBeNull();
  // A signed 403 from an action must win against a late older GET 200.
  expect(adminCollectionCurrentRead(old,session,'schedule',0,true)).toBeNull();
  expect(adminCollectionCurrentRead(old,{...session},'schedule',0)).toBeNull();
  expect(adminCollectionCurrentRead(old,session,'attendance',0)).toBeNull();
  const refreshed={...old,revision:1,data:{...data,rows:[]}};
  expect(adminCollectionCurrentRead(refreshed,session,'schedule',1)?.rows).toEqual([]);
  expect(adminCollectionCurrentRead(refreshed,session,'schedule',0)).toBeNull();
 });
 it('keeps collection refresh available while a signed D1 GET is loading (#314)',()=>{
  // A hung network read must be abortable through the existing revision-based
  // retry path; a disabled refresh would trap the staff operator indefinitely.
  const html=renderToStaticMarkup(<AdminCollectionPanel session={session} view="schedule"/>);
  expect(html).toMatch(/<button(?![^>]*\bdisabled\b)[^>]*>تحديث البيانات<\/button>/);
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
