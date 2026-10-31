'use client';

import { useEffect, useState } from 'react';
import { parseQuranAyahRegions, quranPageMetadataUrl, type QuranAyahRegion } from '../quranSource';
import type { QuranInkStroke, QuranTarget } from '../quranAnnotations';
import { SmoothMadinahPage } from './SmoothMadinahPage';
import { QuranAyahOverlay } from './QuranAyahOverlay';
import { QuranConcealmentOverlay } from './QuranConcealmentOverlay';
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
  /** Present only in memory-test mode. Keys represent intentionally revealed verses. */
  practiceRevealedKeys?: ReadonlySet<string>;
  onSelect: (target: QuranTarget) => void;
  onOpenNote: (target: QuranTarget) => void;
  onInkChange: (page: number, strokes: QuranInkStroke[]) => void;
};

/** Every visible printed page owns its own verified polygons, including both sides of a spread. */
export function ReaderPrintedPage({ page, viewportFit = false, inkMode, color, strokes, selectedKey, noteKeys, focusKeys, allowedKeys, practiceRevealedKeys, onSelect, onOpenNote, onInkChange }: Props) {
  const [regions, setRegions] = useState<QuranAyahRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [regionsForPage,setRegionsForPage] = useState<number|null>(null);

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
      onChange={next => onInkChange(page, next)} />
    <QuranAyahOverlay page={page} regions={verifiedRegions} selectedKey={selectedKey}
      noteKeys={noteKeys} focusKeys={focusKeys} allowedKeys={allowedKeys} enabled={!loading && regionsForPage===page && inkMode === 'off' && practiceRevealedKeys===undefined} onSelect={onSelect} onOpenNote={onOpenNote} />
    {practiceRevealedKeys!==undefined&&<QuranConcealmentOverlay page={page}
     regions={verifiedRegions} revealedKeys={practiceRevealedKeys}/>}
  </>} />;
}
