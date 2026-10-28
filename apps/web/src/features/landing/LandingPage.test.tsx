import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LandingPage } from './LandingPage';

describe('approved landing V3', () => {
  const html = renderToStaticMarkup(<LandingPage />);
  it('contains the approved sections in the right order', () => {
    const ids = ['programs', 'classroom', 'how-it-works', 'enroll', 'faq'];
    const offsets = ids.map((id) => html.indexOf(`id="${id}"`));
    expect(offsets.every((value) => value >= 0)).toBe(true);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  });
  it('routes the trial call-to-action to enrollment', () => {
    expect(html).toContain('href="#enroll"');
    expect(html).toContain('احجز حصة تجريبية');
  });
  it('does not advertise a live booking before registration', () => {
    expect(html).toContain('نسخة تجريبية للواجهة فقط');
  });
});
