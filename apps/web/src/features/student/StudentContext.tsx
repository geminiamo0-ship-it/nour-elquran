'use client';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMockLearnerSnapshot, DEMO_PROFILES, readSessionDemoProfiles } from './mock-adapter';
import { sanitizeStudyNote, type LearnerProfile, type LearnerSnapshot, type LocalStudyNote } from './domain';

type StudentContextValue = {
  learners: readonly LearnerProfile[]; selectedId: string;
  selected: LearnerSnapshot; selectLearner: (id: string) => void;
  finished: readonly string[]; toggleTask: (id: string) => void;
  notes: readonly LocalStudyNote[]; addNote: (lessonId: string, text: string) => boolean;
  removeNote: (noteId: string) => void;
  taskDrafts: Readonly<Record<string, string>>;
  updateTaskDraft: (taskId: string, text: string) => void;
  preparedTasks: readonly string[];
  markTaskPrepared: (taskId: string) => boolean;
  selectedAyat: readonly number[]; toggleAyah: (index: number) => void;
};
const Context = createContext<StudentContextValue | null>(null);

export function StudentProvider({ children }: { children: ReactNode }) {
  const [learners, setLearners] = useState<readonly LearnerProfile[]>(DEMO_PROFILES);
  const [selectedId, setSelectedId] = useState('demo-new');
  const [completed, setCompleted] = useState<Record<string, string[]>>({});
  const [notesByLearner, setNotesByLearner] = useState<Record<string, LocalStudyNote[]>>({});
  const [draftsByLearner, setDraftsByLearner] = useState<Record<string, Record<string, string>>>({});
  const [preparedByLearner, setPreparedByLearner] = useState<Record<string, string[]>>({});
  const [ayatByLearner, setAyatByLearner] = useState<Record<string, number[]>>({});
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

  const notes = notesByLearner[profile.id] ?? [];
  const taskDrafts = draftsByLearner[profile.id] ?? {};
  const preparedTasks = preparedByLearner[profile.id] ?? [];
  const selectedAyat = ayatByLearner[profile.id] ?? [];
  function addNote(lessonId: string, value: string): boolean {
    const text = sanitizeStudyNote(value);
    if (!text || !selected.lessons.some((item) => item.id === lessonId && item.status === 'completed')) return false;
    const note: LocalStudyNote = { id: globalThis.crypto.randomUUID(), learnerId: profile.id,
      lessonId, text, createdAt: new Date().toISOString() };
    setNotesByLearner((prev) => ({ ...prev, [profile.id]: [...(prev[profile.id] ?? []), note] }));
    return true;
  }
  function removeNote(noteId: string) {
    setNotesByLearner((prev) => ({ ...prev,
      [profile.id]: (prev[profile.id] ?? []).filter((note) => note.id !== noteId) }));
  }
  function updateTaskDraft(taskId: string, text: string) {
    if (!selected.tasks.some((task) => task.id === taskId)) return;
    const limited = text.slice(0, 500);
    setDraftsByLearner((prev) => ({ ...prev,
      [profile.id]: { ...prev[profile.id], [taskId]: limited } }));
    setPreparedByLearner((prev) => ({ ...prev,
      [profile.id]: (prev[profile.id] ?? []).filter((id) => id !== taskId) }));
  }
  function markTaskPrepared(taskId: string): boolean {
    if (!selected.tasks.some((task) => task.id === taskId) || !sanitizeStudyNote(taskDrafts[taskId] ?? '')) return false;
    setPreparedByLearner((prev) => ({ ...prev,
      [profile.id]: [...new Set([...(prev[profile.id] ?? []), taskId])] }));
    return true;
  }
  function toggleAyah(index: number) {
    if (!Number.isInteger(index) || index < 0 || index > 3) return;
    setAyatByLearner((prev) => {
      const current = prev[profile.id] ?? [];
      return { ...prev, [profile.id]: current.includes(index)
        ? current.filter((item) => item !== index) : [...current, index] };
    });
  }
  const value = { learners, selectedId: profile.id, selected, selectLearner, finished, toggleTask,
    notes, addNote, removeNote, taskDrafts, updateTaskDraft, preparedTasks,
    markTaskPrepared, selectedAyat, toggleAyah };

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useStudent(): StudentContextValue {
  const context = useContext(Context);
  if (!context) throw new Error('StudentProvider is required');
  return context;
}
