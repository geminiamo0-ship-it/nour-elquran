import Script from 'next/script';
import '@/features/landing/v3/approved.css';
import { Ornament } from '@/features/landing/v3/Ornament';
import { DemoStrip } from '@/features/landing/v3/DemoStrip';
import { Header } from '@/features/landing/v3/Header';
import { Hero } from '@/features/landing/v3/Hero';
import { Benefits } from '@/features/landing/v3/Benefits';
import { Programs } from '@/features/landing/v3/Programs';
import { Classroom } from '@/features/landing/v3/Classroom';
import { Verse } from '@/features/landing/v3/Verse';
import { Audience } from '@/features/landing/v3/Audience';
import { Journey } from '@/features/landing/v3/Journey';
import { Enrollment } from '@/features/landing/v3/Enrollment';
import { Faq } from '@/features/landing/v3/Faq';
import { DashboardModal } from '@/features/landing/v3/DashboardModal';
import { Footer } from '@/features/landing/v3/Footer';

/** Approved V3 is rendered as real React section components, not an HTML redirect. */
export default function HomePage() {
  return <>
    <Ornament />
    <DemoStrip />
    <Header />
    <main>
      <Hero /><Benefits /><Programs /><Classroom /><Verse />
      <Audience /><Journey /><Enrollment /><Faq />
    </main>
    <DashboardModal />
    <Footer />
    <Script src="/landing-v3-interactions.js" strategy="afterInteractive" />
  </>;
}
