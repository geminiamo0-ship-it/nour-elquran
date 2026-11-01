import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminPaidSlotInbox} from './AdminPaidSlotInbox';

describe('#317 admin paid-slot inbox initial privilege gate',()=>{
 it('renders no student, teacher, approval or debit data before signed GET',()=>{
  const session={user:{id:'synthetic-staff',name:'Synthetic Staff'},phoneVerified:true};
  const html=renderToStaticMarkup(<AdminPaidSlotInbox session={session}/>);
  expect(html).toContain('جارٍ التحقق من صلاحيات الإدارة');
  expect(html).toContain('الموافقة والرفض قيد الربط');
  expect(html).not.toContain('Synthetic Learner');
  expect(html).not.toContain('تم اعتماد الحصة');
  expect(html).not.toContain('تم خصم');
 });
});
