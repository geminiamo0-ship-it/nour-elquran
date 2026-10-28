import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { boundaryError, resolvedBoundaryError, findCycle, inspectArchitecture } from '../scripts/check-architecture.mjs';

test('shared UI must never import a feature', () => {
  assert.match(boundaryError('shared/ui/Panel.tsx', '@/features/student-dashboard'), /Shared/);
});

test('cross-feature deep imports are rejected, public imports allowed', () => {
  assert.match(boundaryError('features/a/components/A.tsx', '@/features/b/components/B'), /public index/);
  assert.equal(boundaryError('features/a/components/A.tsx', '@/features/b'), null);
});

test('import cycles are detected', () => {
  assert.deepEqual(findCycle(new Map([['a', ['b']], ['b', ['a']]])), ['a', 'b', 'a']);
  assert.equal(findCycle(new Map([['a', ['b']], ['b', []]])), null);
});

test('current repository feature graph has no violations', () => {
  assert.deepEqual(inspectArchitecture(), []);
});

test('relative imports cannot bypass feature boundaries', () => {
  assert.match(resolvedBoundaryError('features/student/Card.tsx', 'features/teacher/components/Teacher.tsx'), /public index/);
  assert.equal(resolvedBoundaryError('features/student/Card.tsx', 'features/teacher/index.ts'), null);
  assert.match(resolvedBoundaryError('shared/ui/Panel.tsx', 'features/student/index.ts'), /Shared/);
});

test('AST scanner rejects lazy imports and require() across module boundaries', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noor-architecture-'));
  try {
    const write = (relative, content) => {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    };
    write('features/student/Panel.tsx',
      "export async function load() { return import('@/features/teacher/components/Private'); }");
    write('features/teacher/components/Private.tsx', 'export const privateValue = 1;');
    write('shared/ui/Badge.tsx',
      "const feature = require('@/features/teacher'); export { feature };");
    const errors = inspectArchitecture(root);
    assert.ok(errors.some(error => error.includes('Cross-feature') && error.includes('Panel.tsx')));
    assert.ok(errors.some(error => error.includes('Shared') && error.includes('Badge.tsx')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
