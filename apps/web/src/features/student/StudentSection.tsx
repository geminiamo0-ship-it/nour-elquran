'use client';
import { useStudent } from './StudentContext';
import { LessonHub } from './components/LessonHub';
import { MushafWorkspace } from './components/MushafWorkspace';
import { TrainingWorkspace } from './components/TrainingWorkspace';
import { ProgressWorkspace } from './components/ProgressWorkspace';
import { NotebookWorkspace } from './components/NotebookWorkspace';
import { SubscriptionWorkspace } from './components/SubscriptionWorkspace';
import { AccountWorkspace } from './components/AccountWorkspace';
import styles from './StudentPortal.module.css';

export const sections = {
  lessons: { title: 'حصصي وجدولي', caption: 'مواعيد الحصص وسجل اللقاءات في عرض أسبوعي واضح' },
  mushaf: { title: 'المصحف', caption: 'تصفح معاينة تعليمية مع علامات وملاحظات مستقلة' },
  training: { title: 'تدريباتي', caption: 'الورد والواجب المعتمد، والتحضير قبل التسميع' },
  progress: { title: 'تقدمي وتقاريري', caption: 'درجات الحفظ والتلاوة والتجويد كلٌّ على حدة' },
  notebook: { title: 'دفتر الحصص', caption: 'ملخص الحصص وملاحظاتك الشخصية لكل لقاء' },
  subscription: { title: 'الاشتراك', caption: 'الاشتراك والرصيد بعد تفعيل النظام المالي الآمن' },
  account: { title: 'الحساب', caption: 'إدارة ملفات الطلاب داخل الحساب الواحد' },
} as const;
export type StudentSectionName = keyof typeof sections;

const pages = {
  lessons: LessonHub,
  mushaf: MushafWorkspace,
  training: TrainingWorkspace,
  progress: ProgressWorkspace,
  notebook: NotebookWorkspace,
  subscription: SubscriptionWorkspace,
  account: AccountWorkspace,
} satisfies Record<StudentSectionName, () => React.JSX.Element>;

export function StudentSection({ section }: { section: StudentSectionName }) {
  const { selected } = useStudent();
  const Component = pages[section];
  const meta = sections[section];
  // Profile key ensures no unsent note/input from another learner survives switching.
  return <div>
    <header className={styles.pageHeader}><div>
      <p className={styles.eyebrow}>مساحتي التعليمية / {meta.title}</p>
      <h1>{meta.title}</h1><p>{meta.caption}</p>
    </div></header>
    <Component key={selected.profile.id} />
  </div>;
}
