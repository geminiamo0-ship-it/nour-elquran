import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {StudentConnectedPreparation} from './StudentConnectedPreparation';

it('authenticated preparation starts with honest loading, not a fake absence',()=>{
 const html=renderToStaticMarkup(<StudentConnectedPreparation
  learnerId="child-a" onHomework={()=>undefined} onPractice={()=>undefined}/>);
 expect(html).toContain('جارٍ تحميل موعد الحصة من حساب الطالب الموثق');
 expect(html).not.toContain('لا توجد حصة قادمة مؤكدة');
 expect(html).not.toContain('بيانات المعاينة');
 expect(html).not.toContain('موعد مثال');
});
