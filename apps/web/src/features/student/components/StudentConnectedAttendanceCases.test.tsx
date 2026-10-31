import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {StudentConnectedAttendanceCases} from './StudentConnectedAttendanceCases';
it('owner attendance remains empty while signed D1 records are loading, no demo fixtures',()=>{
 const html=renderToStaticMarkup(<StudentConnectedAttendanceCases learnerId="child-a"/>);
 expect(html).toContain('جارٍ تحميل سجل الطالب الموثق');
 expect(html).toContain('البلاغات هنا مبدئية فقط');
 expect(html).not.toContain('حالة توضيحية');
 expect(html).not.toContain('تم خصم');
 expect(html).not.toContain('attendance-demo-');
});
