export const sections = {
  lessons: { title: 'حصصي وجدولي', caption: 'مواعيد الحصص وسجل اللقاءات في عرض أسبوعي واضح' },
  mushaf: { title: 'المصحف', caption: 'تصفح معاينة تعليمية مع علامات وملاحظات مستقلة' },
  training: { title: 'تدريباتي', caption: 'واجباتي من الشيخ، الحفظ والمراجعة الذاتية، والاستعداد للحصة القادمة' },
  progress: { title: 'تقدمي وتقاريري', caption: 'درجات الحفظ والتلاوة والتجويد كلٌّ على حدة' },
  notebook: { title: 'دفتر الحصص', caption: 'ملخص الحصص وملاحظاتك الشخصية لكل لقاء' },
  subscription: { title: 'الاشتراك', caption: 'الاشتراك والرصيد بعد تفعيل النظام المالي الآمن' },
  account: { title: 'الحساب', caption: 'إدارة ملفات الطلاب داخل الحساب الواحد' },
} as const;
export type StudentSectionName = keyof typeof sections;
export const STUDENT_SECTION_SLUGS = Object.keys(sections) as StudentSectionName[];

