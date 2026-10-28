'use client';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMockLearnerSnapshot, DEMO_PROFILES, readSessionDemoProfiles } from './mock-adapter';
import type { LearnerProfile, LearnerSnapshot } from './domain';

type StudentContextValue = {
  learners: readonly LearnerProfile[]; selectedId: string;
  selected: LearnerSnapshot; selectLearner: (id: string) => void;
  finished: readonly string[]; toggleTask: (id: string) => void;
};
const Context = createContext<StudentContextValue | null>(null);

export function StudentProvider({ children }: { children: ReactNode }) {
  const [learners, setLearners] = useState<readonly LearnerProfile[]>(DEMO_PROFILES);
  const [selectedId, setSelectedId] = useState('demo-new');
  const [completed, setCompleted] = useState<Record<string, string[]>>({});
  useEffect(() => {
    // Only a name list is accepted from the browser-only landing mock; no phone/email/media.
    const sessionProfiles = readSessionDemoProfiles(window.sessionStorage);
    if (sessionProfiles.length) {
      setLearners([...sessionProfiles, ...DEMO_PROFILES]);
      setSelectedId(sessionProfiles[0]?.id ?? 'demo-new');
    }
  }, []);
  const profile = learners.find((item) => item.id === selectedId) ?? learners[0] ?? DEMO_PROFILES[0]!;
  const selected = useMemo(() => getMockLearnerSnapshot(profile), [profile]);
  const finished = completed[profile.id] ?? [];
  function selectLearner(id: string) {
    if (learners.some((item) => item.id === id)) setSelectedId(id);
  }
  function toggleTask(id: string) {
    if (!selected.tasks.some((task) => task.id === id)) return;
    setCompleted((old) => {
      const current = old[profile.id] ?? [];
      return { ...old, [profile.id]: current.includes(id) ? current.filter((key) => key !== id) : [...current, id] };
    });
  }
  const value = { learners, selectedId: profile.id, selected, selectLearner, finished, toggleTask };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useStudent(): StudentContextValue {
  const context = useContext(Context);
  if (!context) throw new Error('StudentProvider is required');
  return context;
}
