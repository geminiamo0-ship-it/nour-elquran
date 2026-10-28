import { Ornament, DemoStrip, Header, Hero, Benefits, Programs, Classroom, Verse, Audience, Journey, Enrollment, Faq, DashboardModal, Footer } from '@/features/landing';
import { LandingDemoProvider } from '@/features/landing';

/** The approved V3 is native JSX; interactions are scoped to client components. */
export default function HomePage() {
  return <LandingDemoProvider>
    <Ornament />
    <DemoStrip />
    <Header />
    <main>
      <Hero /><Benefits /><Programs /><Classroom /><Verse />
      <Audience /><Journey /><Enrollment /><Faq />
    </main>
    <DashboardModal />
    <Footer />
  </LandingDemoProvider>;
}
