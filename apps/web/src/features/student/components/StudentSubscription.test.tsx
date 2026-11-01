import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {parseOwnerAcademy,latestPendingAcademyRequest,currentCycleLabel} from '../../shared';
import {StudentProvider} from '../StudentContext';
import {DEMO_PROFILES} from '../mock-adapter';
import {SubscriptionWorkspace} from './SubscriptionWorkspace';
import {HomeSubscriptionStatus} from './HomeSubscriptionStatus';
import {ConnectedSubscriptionLedger} from './ConnectedSubscriptionLedger';
import {ConnectedAcademyOffers} from './ConnectedAcademyOffers';

describe('clean, truthful subscriptions #324',()=>{
 const sample={code:'ACADEMY_OWNER',
  packages:[{versionId:'ver-1',packageId:'pkg-1',title:'باقة ٨ حصص',priceEgp:1600,sessions:8}],
  requests:[{id:'req-1',title:'باقة ٨ حصص',priceEgp:1600,sessions:8,atMs:1760000000000,state:'pending'}],
  whatsappNumber:'201000000000'};
 it('validates actual catalog, request state, and WhatsApp before showing prices',()=>{
  const parsed=parseOwnerAcademy(sample);
  expect(latestPendingAcademyRequest(parsed)?.id).toBe('req-1');
  expect(parsed.packages[0]?.priceEgp).toBe(1600);
  expect(()=>parseOwnerAcademy({...sample,whatsappNumber:'https://example.com'})).toThrow();
  expect(()=>parseOwnerAcademy({...sample,packages:[{...sample.packages[0],priceEgp:-2}]})).toThrow();
  expect(()=>parseOwnerAcademy({...sample,requests:[{...sample.requests[0],state:'paid'}]})).toThrow();
 });
 it('never calls expired academic units an active subscription',()=>{
  expect(currentCycleLabel('expired',1800000000000,1760000000000)).toContain('انتهت');
  expect(currentCycleLabel('within_period',1750000000000,1760000000000)).toContain('انتهت');
  expect(currentCycleLabel('within_period',1800000000000,1760000000000)).toContain('مسجلة');
 });
 it('previews package design without a paid balance, price or payment action',()=>{
  const html=renderToStaticMarkup(<StudentProvider liveLearners={DEMO_PROFILES}
   initialSelectedId="demo-active"><SubscriptionWorkspace/></StudentProvider>);
  expect(html).toContain('الاشتراك والباقات');
  expect(html).toContain('معاينة فقط');
  expect(html).not.toContain('١٬٦٠٠');
  expect(html).not.toContain('تأكيد الدفع');
  expect(html).not.toContain('wa.me/');
 });
 it('shows one compact home link to the visual subscription route',()=>{
  const html=renderToStaticMarkup(<HomeSubscriptionStatus preview basePath="/preview/student"/>);
  expect(html).toContain('href="/preview/student/subscription"');
  expect(html).toContain('معاينة الباقات');
  expect(html).not.toContain('تم الدفع');
 });
 it('signed initial render remains safely pending, without fabricated zero or paid status',()=>{
  const ledger=renderToStaticMarkup(<ConnectedSubscriptionLedger learnerId="child-a"/>);
  const offers=renderToStaticMarkup(<ConnectedAcademyOffers learnerId="child-a"/>);
  expect(ledger).toContain('جارٍ التحقق من سجل هذا الطالب');
  expect(offers).toContain('جارٍ تحميل الباقات');
  expect(ledger+offers).not.toContain('اشتراك نشط');
  expect(ledger+offers).not.toContain('تم الدفع');
  expect(ledger+offers).not.toContain('0 حصص');
 });
});
