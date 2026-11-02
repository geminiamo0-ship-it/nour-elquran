import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {parseOwnerAcademy,latestPendingAcademyRequest,currentCycleLabel} from '../../shared';
import {StudentProvider} from '../StudentContext';
import {DEMO_PROFILES} from '../mock-adapter';
import {SubscriptionWorkspace} from './SubscriptionWorkspace';
import {HomeSubscriptionStatus,homeSubscriptionSummary} from './HomeSubscriptionStatus';
import {ConnectedSubscriptionLedger} from './ConnectedSubscriptionLedger';
import {ConnectedAcademyOffers,createAcademyPackageRequestGate,
 classifyAcademyPackageRequestResponse} from './ConnectedAcademyOffers';

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
 it('does not claim a missing subscription when only the catalog succeeded',()=>{
  const academy=parseOwnerAcademy({...sample,requests:[]});
  const unknown=homeSubscriptionSummary(null,academy,1760000000000);
  expect(unknown.status).toContain('تعذّر التحقق');
  expect(unknown.status).not.toContain('لم يُؤكَّد الاشتراك');
  const pending=homeSubscriptionSummary(null,parseOwnerAcademy(sample),1760000000000);
  expect(pending.status).toContain('قيد المراجعة');
  expect(homeSubscriptionSummary(null,null,1760000000000).status)
   .toContain('تعذّر التحقق');
 });
 it('requires the exact D1 create/replay ACK before calling a package request confirmed',()=>{
  const id='11111111-1111-4111-8111-111111111111';
  expect(classifyAcademyPackageRequestResponse(201,{
   code:'ACADEMY_REQUEST_CREATED',academyRequestId:id})).toBe('ack');
  expect(classifyAcademyPackageRequestResponse(200,{
   code:'ACADEMY_REQUEST_REPLAY',academyRequestId:id,requestId:'synthetic'})).toBe('ack');
  for(const [status,payload] of [
   [201,{code:'ACADEMY_REQUEST_CREATED'}],
   [201,{code:'ACADEMY_REQUEST_CREATED',academyRequestId:'invalid'}],
   [200,{code:'ACADEMY_REQUEST_CREATED',academyRequestId:id}],
   [201,{code:'ACADEMY_REQUEST_REPLAY',academyRequestId:id}],
   [201,{code:'ACADEMY_REQUEST_CREATED',academyRequestId:id,paid:true}],
   [408,null],[425,null],[429,null],[503,{code:'ACADEMY_UNAVAILABLE'}],
   [0,null]
  ] as const)expect(classifyAcademyPackageRequestResponse(status,payload))
   .toBe('uncertain');
  for(const status of [400,401,403,404,409,422])
   expect(classifyAcademyPackageRequestResponse(status,{code:'ACADEMY_REQUEST_DENIED'}))
    .toBe('denied');
 });
 it('isolates the complete package write gate and owner-read view on sibling switch',()=>{
  // The outer wrapper has no hooks: React remounts the keyed inner component,
  // so an old learner's pending POST/GET cannot update the new learner's view.
  const first=ConnectedAcademyOffers({learnerId:'synthetic-learner-a'});
  const sibling=ConnectedAcademyOffers({learnerId:'synthetic-learner-b'});
  expect(first.key).toBe('synthetic-learner-a');
  expect(sibling.key).toBe('synthetic-learner-b');
  expect(first.type).toBe(sibling.type);
  expect(first.props.learnerId).toBe('synthetic-learner-a');
  expect(sibling.props.learnerId).toBe('synthetic-learner-b');
 });
 it('latches one operationId across double taps, ambiguous outcomes and explicit replay',()=>{
  const gate=createAcademyPackageRequestGate();
  expect(gate.begin()).toBe(true);
  expect(gate.begin()).toBe(false);
  expect(gate.begin(true)).toBe(false);
  gate.finish(true);
  expect(gate.status()).toBe('uncertain');
  expect(gate.releaseAfterRead()).toBe(false);
  expect(gate.begin()).toBe(false);
  expect(gate.begin(true)).toBe(true);
  expect(gate.begin(true)).toBe(false);
  gate.finish(false);
  expect(gate.status()).toBe('closed');
  expect(gate.begin()).toBe(false);
  expect(gate.begin(true)).toBe(false);
  // A confirmed ACK still needs a signed D1 read of the immutable request.
  expect(gate.releaseAfterRead()).toBe(true);
  expect(gate.begin()).toBe(true);
  gate.finish(false);
  expect(gate.releaseAfterRead()).toBe(true);
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
