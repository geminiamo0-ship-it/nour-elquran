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
export { clampQuranPage,parseQuranAyahRegions,parseSurahIndex,
 quranPageMetadataUrl,quranSurahIndexUrl } from './quranSource';
export type {QuranSurahInfo,QuranAyahRegion} from './quranSource';

/** Printed SVG component is shared with the authenticated read-only classroom. */
export { SmoothMadinahPage } from './components/SmoothMadinahPage';
