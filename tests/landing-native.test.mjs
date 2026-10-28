import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const feature = 'apps/web/src/features/landing/v3/';
const sections = [
  'Ornament', 'DemoStrip', 'Header', 'Hero', 'Benefits', 'Programs',
  'Classroom', 'Verse', 'Audience', 'Journey', 'Enrollment', 'Faq',
  'DashboardModal', 'Footer',
];

test('every landing section renders native JSX without injected HTML', () => {
  for (const section of sections) {
    const content = readFileSync(feature + section + '.tsx', 'utf8');
    assert.doesNotMatch(content, /dangerouslySetInnerHTML|__html|DOMParser/, section);
    assert.match(content, /export function /, section);
  }
});

test('landing interactions are owned by React rather than a public DOM script', () => {
  const page = readFileSync('apps/web/src/app/page.tsx', 'utf8');
  assert.match(page, /LandingDemoProvider/);
  assert.doesNotMatch(page, /next\/script|landing-v3-interactions/);
  assert.equal(existsSync('apps/web/public/landing-v3-interactions.js'), false);
});
