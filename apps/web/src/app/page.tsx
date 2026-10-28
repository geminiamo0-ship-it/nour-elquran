import Script from 'next/script';
import { Ornament, DemoStrip, Header, Hero, Benefits, Programs, Classroom, Verse, Audience, Journey, Enrollment, Faq, DashboardModal, Footer } from '@/features/landing';

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
