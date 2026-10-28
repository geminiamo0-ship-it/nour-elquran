'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useLandingDemo } from './LandingDemoProvider';

export function Enrollment() {
  const { openDashboard } = useLandingDemo();
  const [isChild, setIsChild] = useState(true);
  const [siblings, setSiblings] = useState<number[]>([]);
  const nextSibling = useRef(0);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    const account = String(fields.get('accountName') ?? '').trim();
    const main = String(fields.get('learnerName') ?? '').trim();
    const extras = isChild ? fields.getAll('siblings').map(String).map((x) => x.trim()).filter(Boolean) : [];
    if (!account || !main) return;
    openDashboard(account, [main, ...extras]);
  }
  return (<section className="enroll simplified-enroll" id="enroll">

      <div className="container">
        <div className="enroll-title"><span className="eyebrow">البِدَايَةُ مِنْ هُنَا</span></div>
        <form className="registration-shell" id="registrationForm" onSubmit={submit}><h3>ابدأ رحلتك القرآنية</h3><p className="sub">تجربة تسجيل تفاعلية — ستظهر لوحة الطالب بعد الإكمال مباشرة.</p>
          <div className="fields"><div className="field"><label htmlFor="accountName">اسم صاحب الحساب <span className="required-mark" aria-hidden="true">*</span></label><input id="accountName" autoComplete="name" name="accountName" required maxLength={60} placeholder="الاسم الذي سنناديك به" /></div><div className="field"><label htmlFor="parentPhone" id="parentPhoneLabel">{isChild ? "رقم موبايل ولي الأمر" : "رقم الموبايل"} <span className="required-mark" aria-hidden="true">*</span></label><input id="parentPhone" name="parentPhone" type="tel" autoComplete="tel" inputMode="tel" required minLength={11} maxLength={13} pattern="(?:01[0125][0-9]{8}|\+201[0125][0-9]{8})" title="رقم موبايل مصري صحيح يبدأ بـ 01 أو +20" placeholder="01xxxxxxxxx" dir="ltr" aria-describedby="phoneHelp" /></div></div>
          <div className="field full" style={{"marginTop":"14px"}}><label htmlFor="accountContact">البريد الإلكتروني <span className="optional-mark">(اختياري للمعاينة)</span></label><input id="accountContact" name="accountContact" type="email" autoComplete="email" maxLength={80} placeholder="example@mail.com" dir="ltr" /><span className="input-hint" id="phoneHelp">رقم التواصل أساسي لتأكيد الحصص والتواصل مع ولي الأمر لاحقًا. لن نرسل أي رسالة من هذه النسخة التجريبية.</span></div>
          <div className="field" style={{"marginTop":"15px"}}><label>لمن تريد إنشاء ملف طالب؟</label><div className="audience-selector"><label><input type="radio" name="learnerType" value="child" defaultChecked onChange={() => setIsChild(true)} /> لطفلي / لأحد أفراد الأسرة</label><label><input type="radio" name="learnerType" value="self" onChange={() => setIsChild(false)} /> لنفسي</label></div></div>
          <div className="fields"><div className="field"><label id="learnerNameLabel" htmlFor="learnerName">{isChild ? "اسم الطفل الأول" : "اسم الطالب"}</label><input id="learnerName" name="learnerName" required maxLength={50} placeholder="اسم الطالب" /></div><div className="field"><label htmlFor="learnerLevel">المستوى التقريبي</label><select id="learnerLevel" required defaultValue=""><option value="" disabled>اختر المستوى</option><option>يبدأ من الصفر</option><option>يقرأ ويحتاج تصحيحًا</option><option>يحفظ بعض السور</option><option>يريد المراجعة والتثبيت</option></select></div></div>
          <div id="siblingsArea" hidden={!isChild}><div className="sibling-list" id="siblingList">{siblings.map((id) => <div className="sibling-field" key={id}><input name="siblings" aria-label="اسم الطفل الإضافي" placeholder="اسم الطفل الآخر" maxLength={50} /><button type="button" onClick={() => setSiblings((list) => list.filter((value) => value !== id))}>حذف</button></div>)}</div><button type="button" className="add-sibling" id="addSiblingBtn" onClick={() => { const id = nextSibling.current++; setSiblings((list) => [...list, id]); }}>+ إضافة طفل آخر لنفس الحساب</button></div>
          <button type="submit" className="btn btn-gold" style={{"marginTop":"20px","width":"100%"}}>إنشاء حساب تجريبي وفتح لوحة الطالب ↖</button><p className="form-note">لا توجد كلمة مرور أو رمز تحقق في هذا الـMock. الربط الآمن مع Supabase Auth يأتي في مرحلة الـBackend.</p>
        </form>
      </div>
    
  </section>);
}
