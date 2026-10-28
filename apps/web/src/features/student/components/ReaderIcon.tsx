import type { ReactNode } from 'react';

type Name = 'marker' | 'pen' | 'search' | 'notes' | 'ayah' | 'settings' | 'index' | 'book' | 'play' | 'pause';
const drawings: Record<Name, ReactNode> = {
  play: <path d="m8 5 11 7-11 7z"/>,
  pause: <><path d="M8 5v14M16 5v14"/></>,
  marker: <><path d="m4 17 7-7 7 7-5 4H6z"/><path d="m10 10 2-2 7 7-2 2"/><path d="M4 22h16"/></>,
  pen: <><path d="m15 5 4 4"/><path d="M4 20l4.5-1 11-11a2 2 0 0 0-3-3L5.5 16z"/><path d="M4 22h16"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  notes: <><rect x="4" y="3" width="15" height="18" rx="2"/><path d="M8 7h7M8 11h7M8 15h4"/></>,
  ayah: <><path d="M5 4h13v16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M12 4v16M9 9h1m4 0h1M9 13h1m4 0h1"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
  index: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  book: <><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1z"/><path d="M12 5v15"/></>,
};
export function ReaderIcon({ name }: { name: Name }) {
  return <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    {drawings[name]}
  </svg>;
}
