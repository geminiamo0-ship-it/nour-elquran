import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {ConnectedSubscriptionLedger} from './ConnectedSubscriptionLedger';
it('shows only pending signed read before any owner ledger arrives',()=>{
 const html=renderToStaticMarkup(<ConnectedSubscriptionLedger learnerId="child-a"/>);
 expect(html).toContain('جارٍ التحقق من سجل هذا الطالب');
 expect(html).not.toContain('اشتراك نشط');
 expect(html).not.toContain('تم الدفع');
 expect(html).not.toContain('8 حصص');
});
