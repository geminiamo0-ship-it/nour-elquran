import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AccountProvider } from '@/features/account';

export const metadata: Metadata = {
  title: 'نور القرآن | للحفظ والإتقان',
  description: 'منصة نور القرآن للحفظ والتلاوة والمراجعة مع الشيخ.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body><AccountProvider>{children}</AccountProvider></body>
    </html>
  );
}

