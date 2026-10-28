import type { ReactNode } from 'react';

type SurfaceCardProps = Readonly<{
  children: ReactNode;
  className?: string;
}>;

export function SurfaceCard({ children, className = '' }: SurfaceCardProps) {
  return (
    <section className={`noor-card ${className}`}>
      {children}
      <style>{`
        .noor-card {
          background: var(--paper-2);
          border: 1px solid var(--border);
          border-radius: 9px;
          box-shadow: 0 12px 24px rgb(33 56 46 / 5%);
          padding: clamp(24px, 4vw, 44px);
        }
      `}</style>
    </section>
  );
}
