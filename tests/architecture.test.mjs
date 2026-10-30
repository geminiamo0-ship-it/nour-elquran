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

test('TypeScript import-equals require cannot bypass feature or route boundaries', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noor-import-equals-'));
  try {
    const write = (relative, source) => {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, source);
    };
    write('features/teacher/internal/Secret.ts', 'export const secret = 1;');
    write('features/teacher/index.ts', 'export const publicValue = 1;');
    write('features/student/Public.ts',
      "import Teacher = require('@/features/teacher'); export { Teacher };");
    write('features/student/Legacy.ts',
      "import Secret = require('@/features/teacher/internal/Secret'); export { Secret };");
    write('app/LegacyRoute.ts',
      "import Secret = require('../features/teacher/internal/Secret'); export { Secret };");
    const errors = inspectArchitecture(root);
    // Alias imports may report both the syntactic and resolved-path violation.
    assert.ok(errors.length >= 2, errors.join('\\n'));
    assert.ok(errors.every(error => !error.includes('features/student/Public.ts')));
    assert.ok(errors.some(error => error.includes('features/student/Legacy.ts')
      && error.includes('Cross-feature')));
    assert.ok(errors.some(error => error.includes('app/LegacyRoute.ts')
      && error.includes('public index')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('TypeScript import-equals edges enforce shared isolation and cycle detection', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noor-import-equals-graph-'));
  try {
    const write = (relative, source) => {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, source);
    };
    write('features/student/A.ts',
      "import B = require('./B'); export const a = B.b;");
    write('features/student/B.ts',
      "import A = require('./A'); export const b = A.a;");
    write('features/teacher/index.ts', 'export const teacher = true;');
    write('shared/ui/Leak.ts',
      "import Teacher = require('../../features/teacher'); export { Teacher };");

    const errors = inspectArchitecture(root);
    assert.ok(errors.some(error => error.includes('Circular dependency:')
      && error.includes('features/student/A.ts')
      && error.includes('features/student/B.ts')), errors.join('\\n'));
    assert.ok(errors.some(error => error.includes('shared/ui/Leak.ts')
      && error.includes('Shared modules cannot depend')), errors.join('\\n'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('type-only import() dependencies cannot bypass feature or shared boundaries', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noor-import-type-'));
  try {
    const write = (relative, source) => {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, source);
    };
    write('features/teacher/internal/Secret.ts', 'export interface Secret { value: string }');
    write('features/teacher/index.ts', "export type { Secret } from './internal/Secret';");
    write('features/student/Deep.ts',
      "export type Secret = import('@/features/teacher/internal/Secret').Secret;");
    write('features/student/Public.ts',
      "export type Secret = import('@/features/teacher').Secret;");
    write('app/Deep.ts',
      "export type Secret = import('../features/teacher/internal/Secret').Secret;");
    write('shared/ui/Deep.ts',
      "export type Secret = typeof import('../../features/teacher');");

    const errors = inspectArchitecture(root);
    assert.ok(errors.some(error => error.includes('features/student/Deep.ts')
      && error.includes('Cross-feature')), errors.join('\\n'));
    assert.ok(errors.some(error => error.includes('app/Deep.ts')
      && error.includes('public index')), errors.join('\\n'));
    assert.ok(errors.some(error => error.includes('shared/ui/Deep.ts')
      && error.includes('Shared modules cannot depend')), errors.join('\\n'));
    assert.ok(errors.every(error => !error.includes('features/student/Public.ts')), errors.join('\\n'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('route entrypoints can only consume a feature public API', () => {
  assert.match(boundaryError('app/page.tsx', '@/features/teacher/components/Private'), /public index/);
  assert.equal(boundaryError('app/page.tsx', '@/features/teacher'), null);
  assert.equal(boundaryError('app/page.tsx', '@/features/teacher/index'), null);
  assert.match(resolvedBoundaryError('app/page.tsx', 'features/teacher/components/Private.tsx'), /public index/);
  assert.equal(resolvedBoundaryError('app/page.tsx', 'features/teacher/index.ts'), null);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noor-route-boundary-'));
  try {
    const write = (relative, content) => {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    };
    write('features/teacher/components/Private.tsx', 'export const privateValue = 1;');
    write('features/teacher/index.ts', "export { privateValue } from './components/Private';");
    write('app/alias.tsx', "export { privateValue } from '@/features/teacher/components/Private';");
    write('app/relative.tsx', "export { privateValue } from '../features/teacher/components/Private';");
    write('app/lazy.tsx', "export async function load() { return import('@/features/teacher/components/Private'); }");
    write('app/valid.tsx', "export { privateValue } from '@/features/teacher';");

    const errors = inspectArchitecture(root);
    assert.equal(errors.length, 3, errors.join('\n'));
    for (const route of ['alias.tsx', 'relative.tsx', 'lazy.tsx']) {
      assert.ok(errors.some(error => error.includes(route) && error.includes('public index')), route);
    }
    assert.ok(errors.every(error => !error.includes('valid.tsx')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
