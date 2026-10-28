
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const here = join(process.cwd(), 'src/features/landing/v3');
const components = ["Ornament","DemoStrip","Header","Hero","Benefits","Programs","Classroom","Verse","Audience","Journey","Enrollment","Faq","DashboardModal","Footer"];
describe('native React landing V3', () => {
  it('renders approved sections through JSX rather than injected HTML', () => {
    for (const name of components) {
      const file = readFileSync(join(here, name + '.tsx'), 'utf8');
      expect(file).not.toContain('dangerouslySetInnerHTML');
      expect(file).not.toContain('document.querySelector');
      expect(file).not.toContain('innerHTML');
    }
  });
  it('uses scoped hooks for classroom, registration and dashboard interactions', () => {
    for (const name of ['Classroom', 'Enrollment', 'DashboardModal']) {
      const file = readFileSync(join(here, name + '.tsx'), 'utf8');
      expect(file).toContain("'use client'");
      expect(file).toMatch(/onClick=|onSubmit=/);
    }
  });
});
