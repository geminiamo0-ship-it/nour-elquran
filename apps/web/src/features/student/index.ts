export { StudentShell } from './StudentShell';
export { StudentDashboard } from './StudentDashboard';
export { StudentSection } from './StudentSection';
export { sections, STUDENT_SECTION_SLUGS } from './sectionRoutes';
export type { StudentSectionName } from './sectionRoutes';

/** Canonical verified Quran reader reused in classroom; never fork printed pages. */
export { ReaderPrintedPage } from './components/ReaderPrintedPage';
export type { InkMode } from './components/QuranInk';
export type { QuranInkStroke, QuranTarget } from './quranAnnotations';
export { targetKey } from './quranAnnotations';
export { clampQuranPage } from './quranSource';
