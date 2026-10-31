import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {StudentConnectedInbox} from './StudentConnectedInbox';
it('student notices never render parent or sibling fixtures before signed owner response',()=>{
 const html=renderToStaticMarkup(<StudentConnectedInbox learnerId="child-a"/>);
 expect(html).toContain('جارٍ قراءة الإشعارات الموثقة');
 expect(html).toContain('إشعارات الطالب الحقيقية');
 expect(html).not.toContain('حصة مؤكدة');
 expect(html).not.toContain('تم التسليم');
});
