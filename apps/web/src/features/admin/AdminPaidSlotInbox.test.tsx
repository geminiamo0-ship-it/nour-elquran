import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminPaidSlotInbox} from './AdminPaidSlotInbox';
import {AdminPaidSlotDecision} from './AdminPaidSlotDecision';

describe('#317 admin paid-slot inbox initial privilege gate',()=>{
 it('renders no student, teacher, approval or debit data before signed GET',()=>{
  const session={user:{id:'synthetic-staff',name:'Synthetic Staff'},phoneVerified:true};
  const html=renderToStaticMarkup(<AdminPaidSlotInbox session={session}/>);
  expect(html).toContain('جارٍ التحقق من صلاحيات الإدارة');
  expect(html).toContain('جارٍ التحقق من صلاحيات الإدارة');
  expect(html).not.toContain('اعتماد الموعد وخصم حصة');
  expect(html).not.toContain('Synthetic Learner');
  expect(html).not.toContain('تم اعتماد الحصة');
  expect(html).not.toContain('تم خصم');
 });
 it('shows explicit audited action only for a pending row, without optimistic credit',()=>{
  const row={requestId:'11111111-1111-4111-8111-111111111111',
   learnerId:'22222222-2222-4222-8222-222222222222',
   learnerName:'Synthetic Learner',
   teacherId:'33333333-3333-4333-8333-333333333333',
   teacherName:'Synthetic Sheikh',startsAtMs:1793600000000,
   endsAtMs:1793602400000,state:'pending' as const,lessonId:null};
  const html=renderToStaticMarkup(<AdminPaidSlotDecision request={row}
   onCommitted={()=>{}}/>);
  expect(html).toContain('قرار إداري مدقّق');
  expect(html).toContain('disabled');
  expect(html).toContain('الرفض لا يخصم');
  expect(html).not.toContain('تم خصم');
 });
});
