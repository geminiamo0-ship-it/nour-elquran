import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WelcomePanel } from './WelcomePanel';

describe('foundation UI', () => {
  it('renders the Arabic identity and marks all operations as unavailable', () => {
    const html = renderToStaticMarkup(<WelcomePanel />);
    expect(html).toContain('نور القرآن');
    expect(html).toContain('نسخة تجريبية');
    expect(html).toContain('لا توجد حسابات أو حجوزات');
  });
});
