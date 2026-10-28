'use client';

import { useEffect, useState } from 'react';
import { parseQuranAyahRegions, quranPageMetadataUrl, type QuranAyahRegion } from '../quranSource';
import type { QuranInkStroke, QuranTarget } from '../quranAnnotations';
import { SmoothMadinahPage } from './SmoothMadinahPage';
import { QuranAyahOverlay } from './QuranAyahOverlay';
import { QuranInk, type InkMode } from './QuranInk';

type Props = {
  page: number;
  inkMode: InkMode;
  color: string;
  strokes: readonly QuranInkStroke[];
  selectedKey: string | null;
  noteKeys: ReadonlySet<string>;
  onSelect: (target: QuranTarget) => void;
  onOpenNote: (target: QuranTarget) => void;
  onInkChange: (page: number, strokes: QuranInkStroke[]) => void;
};

/** Every visible printed page owns its own verified polygons, including both sides of a spread. */
export function ReaderPrintedPage({ page, inkMode, color, strokes, selectedKey, noteKeys, onSelect, onOpenNote, onInkChange }: Props) {
  const [regions, setRegions] = useState<QuranAyahRegion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setRegions([]);
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
      if (!controller.signal.aborted) setRegions(parseQuranAyahRegions(data));
    })().catch(() => { if (!controller.signal.aborted) setRegions([]); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page]);

  return <SmoothMadinahPage page={page} overlay={<>
    <QuranInk page={page} mode={inkMode} color={color} strokes={strokes}
      onChange={next => onInkChange(page, next)} />
    <QuranAyahOverlay page={page} regions={regions} selectedKey={selectedKey}
      noteKeys={noteKeys} enabled={!loading && inkMode === 'off'} onSelect={onSelect} onOpenNote={onOpenNote} />
  </>} />;
}
