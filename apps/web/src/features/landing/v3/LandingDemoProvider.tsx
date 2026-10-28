'use client';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type DemoTab = 'home' | 'classes' | 'quran' | 'training' | 'progress';
type DemoContext = {
  open: boolean;
  accountName: string;
  students: string[];
  activeStudent: string;
  tab: DemoTab;
  bookings: Record<string, string>;
  openDashboard: (account: string, learners: string[]) => void;
  closeDashboard: () => void;
  selectStudent: (student: string) => void;
  selectTab: (tab: DemoTab) => void;
  selectSlot: (slot: string) => void;
};
const Context = createContext<DemoContext | null>(null);

export function LandingDemoProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [students, setStudents] = useState<string[]>([]);
  const [activeStudent, setActiveStudent] = useState('');
  const [tab, selectTab] = useState<DemoTab>('home');
  const [bookings, setBookings] = useState<Record<string, string>>({});
  const openDashboard = useCallback((account: string, learners: string[]) => {
    const unique = [...new Set(learners.map((x) => x.trim()).filter(Boolean))];
    if (!unique.length) return;
    setAccountName(account);
    setStudents(unique);
    setActiveStudent(unique[0]);
    setBookings({});
    selectTab('home');
    setOpen(true);
  }, []);
  const closeDashboard = useCallback(() => setOpen(false), []);
  const selectStudent = useCallback((student: string) => {
    if (!students.includes(student)) return;
    setActiveStudent(student);
    selectTab('home');
  }, [students]);
  const selectSlot = useCallback((slot: string) => {
    if (!activeStudent) return;
    setBookings((previous) => ({ ...previous, [activeStudent]: slot }));
  }, [activeStudent]);
  const value = useMemo(() => ({
    open, accountName, students, activeStudent, tab, bookings,
    openDashboard, closeDashboard, selectStudent, selectTab, selectSlot,
  }), [open, accountName, students, activeStudent, tab, bookings,
    openDashboard, closeDashboard, selectStudent, selectSlot]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLandingDemo(): DemoContext {
  const context = useContext(Context);
  if (!context) throw new Error('LandingDemoProvider is required');
  return context;
}
