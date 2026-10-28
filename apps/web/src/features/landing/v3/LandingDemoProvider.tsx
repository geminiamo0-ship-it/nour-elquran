'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

/** Ephemeral browser-only demonstration. No authentication, network writes or persistence. */
export type DemoSession = Readonly<{ accountName: string; learners: readonly string[] }>;
type DemoContextValue = Readonly<{
  session: DemoSession | null;
  start: (session: DemoSession) => void;
  close: () => void;
}>;
const DemoContext = createContext<DemoContextValue | null>(null);

export function LandingDemoProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [session, setSession] = useState<DemoSession | null>(null);
  return (
    <DemoContext.Provider value={{ session, start: setSession, close: () => setSession(null) }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useLandingDemo(): DemoContextValue {
  const context = useContext(DemoContext);
  if (!context) throw new Error('LandingDemoProvider is required');
  return context;
}
