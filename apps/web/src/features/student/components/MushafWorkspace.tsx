'use client';

import { MadinahReader } from './MadinahReader';
import {useStudent} from '../StudentContext';

/** App-like Quran reader shell, intentionally outside dashboard panels and cards. */
export function MushafWorkspace() {
  const {selected}=useStudent();
  return <MadinahReader key={selected.profile.id} />;
}
