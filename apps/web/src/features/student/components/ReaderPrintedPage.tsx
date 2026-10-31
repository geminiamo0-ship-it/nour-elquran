'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseQuranAyahRegions, quranPageMetadataUrl, type QuranAyahRegion } from '../quranSource';
import type { QuranInkStroke, QuranTarget } from '../quranAnnotations';
import { SmoothMadinahPage } from './SmoothMadinahPage';
import { QuranAyahOverlay } from './QuranAyahOverlay';
import { QuranConcealmentOverlay } from './QuranConcealmentOverlay';
import { useCumulativeQuranPage } from '../useCumulativeQuranPage';
import css from './ReaderAcademicOverlay.module.css';
import { QuranInk, type InkMode } from './QuranInk';

type Props = {
  page: number;
  viewportFit?: boolean;
  inkMode: InkMode;
  color: string;
  strokes: readonly QuranInkStroke[];
  selectedKey: string | null;
  noteKeys: ReadonlySet<string>;
  focusKeys?: ReadonlySet<string>;
  allowedKeys?: ReadonlySet<string>;
  /** Verified household-owner ID only; never a teacher-supplied learner ID. */
  cumulativeLearnerId?: string;
  /** Training alone displays legacy private ink read-only. Personal Reader owns its editable private layer. */
  includeLegacyPrivate?: boolean;
  /** Present only in memory-test mode. Keys represent intentionally revealed verses. */
  practiceRevealedKeys?: ReadonlySet<string>;
  onSelect: (target: QuranTarget) => void;
  onOpenNote: (target: QuranTarget) => void;
  onInkChange: (page: number, strokes: QuranInkStroke[]) => void;
};

/** Every visible printed page owns its own verified polygons, including both sides of a spread. */
export function ReaderPrintedPage({ page, viewportFit = false, inkMode, color, strokes, selectedKey, noteKeys, focusKeys, allowedKeys, cumulativeLearnerId, includeLegacyPrivate = false, practiceRevealedKeys, onSelect, onOpenNote, onInkChange }: Props) {
  const [regions, setRegions] = useState<QuranAyahRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [regionsForPage,setRegionsForPage] = useState<number|null>(null);
  const academic=useCumulativeQuranPage(cumulativeLearnerId,page);
  const [activeNote,setActiveNote]=useState<{page:number;learnerId?:string;text:string}|null>(null);
  const readonlyInk=useMemo(()=>[...academic.sharedInk,...(includeLegacyPrivate?academic.legacyInk:[])],
   [academic.sharedInk,academic.legacyInk,includeLegacyPrivate]);
  const combinedNoteKeys=useMemo(()=>new Set([...noteKeys,...academic.academicNotes.map(n=>n.surah+':'+n.ayah)]),
   [noteKeys,academic.academicNotes]);
  function showAcademicNote(target:QuranTarget):boolean{
   const entry=academic.academicNotes.find(n=>n.kind==='note'&&
    n.surah===target.surah&&n.ayah===target.ayah&&typeof n.payload.text==='string');
   if(!entry)return false;
   setActiveNote({page,learnerId:cumulativeLearnerId,text:String(entry.payload.text)});
   return true;
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setRegions([]);
    setRegionsForPage(null);
    (async () => {
      let data: unknown;
      try {
        const result = await fetch(quranPageMetadataUrl(page), { signal: controller.signal });
        if (!result.ok) throw new Error('R2 page metadata unavailable');
        data = await result.json() as unknown;
      } catch (error) {
        if (controller.signal.aborted) return;
        const response = await fetch(quranPageMetadataUrl(page, true), { signal: controller.signal });
        if (!response.ok) throw error;
        data = await response.json() as unknown;
      }
      if (!controller.signal.aborted){setRegions(parseQuranAyahRegions(data));setRegionsForPage(page);}
    })().catch(() => { if (!controller.signal.aborted) setRegions([]); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page]);

  const verifiedRegions=regionsForPage===page?regions:[];
  return <SmoothMadinahPage page={page} viewportFit={viewportFit}
   concealArtwork={practiceRevealedKeys!==undefined} overlay={<>
    <QuranInk page={page} mode={inkMode} color={color} strokes={strokes}
      fixedStrokes={readonlyInk} onChange={next => onInkChange(page, next)} />
    <QuranAyahOverlay page={page} regions={verifiedRegions} selectedKey={selectedKey}
      noteKeys={combinedNoteKeys} focusKeys={focusKeys} allowedKeys={allowedKeys} enabled={!loading && regionsForPage===page && inkMode === 'off' && practiceRevealedKeys===undefined}
      onSelect={target=>{showAcademicNote(target);onSelect(target);}}
      onOpenNote={target=>{if(!showAcademicNote(target))onOpenNote(target);}} />
    {cumulativeLearnerId&&academic.status==='failed'&&
     <span className={css.status} role="status">تعذّر تحميل علامات الشيخ لهذه الصفحة. القراءة متاحة، لكن العلامات غير مؤكدة.</span>}
    {practiceRevealedKeys===undefined&&activeNote?.page===page&&
      activeNote.learnerId===cumulativeLearnerId&&
      <div className={css.note} role="note">
       <strong>ملاحظة الشيخ</strong><span>{activeNote.text}</span>
       <button type="button" onClick={()=>setActiveNote(null)} aria-label="إغلاق ملاحظة الشيخ">×</button>
      </div>}
    {practiceRevealedKeys!==undefined&&<QuranConcealmentOverlay page={page}
     regions={verifiedRegions} revealedKeys={practiceRevealedKeys}/>}
  </>} />;
}
