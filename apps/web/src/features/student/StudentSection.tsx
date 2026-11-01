'use client';
import { useStudent } from './StudentContext';
import { sections, type StudentSectionName } from './sectionRoutes';
import { LessonHub } from './components/LessonHub';
import { MushafWorkspace } from './components/MushafWorkspace';
import { TrainingWorkspace } from './components/TrainingWorkspace';
import { ProgressWorkspace } from './components/ProgressWorkspace';
import { NotebookWorkspace } from './components/NotebookWorkspace';
import { SubscriptionWorkspace } from './components/SubscriptionWorkspace';
import { AccountWorkspace } from './components/AccountWorkspace';
import styles from './StudentPortal.module.css';

const pages = {
  lessons: () => <LessonHub />,
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
  const meta = section==='progress'||section==='notebook'?sections.lessons:sections[section];
  // Profile key ensures no unsent note/input from another learner survives switching.
  return <div>
    {section !== 'mushaf' && <header className={styles.pageHeader}><div>
      <p className={styles.eyebrow}>مساحتي التعليمية / {meta.title}</p>
      <h1>{meta.title}</h1><p>{meta.caption}</p>
    </div></header>}
    {section==='progress'?<LessonHub key={selected.profile.id} initialTab="reports"/>:
     section==='notebook'?<LessonHub key={selected.profile.id} initialTab="notebook"/>:
     <Component key={selected.profile.id} />}
  </div>;
}
