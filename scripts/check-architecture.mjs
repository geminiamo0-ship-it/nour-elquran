import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(repoRoot, 'apps/web/src');

export function boundaryError(importer, specifier) {
  const source = importer.replaceAll('\\', '/');
  const requested = specifier.replaceAll('\\', '/');
  const insideShared = source.startsWith('shared/');
  const featureMatch = source.match(/^features\/([^/]+)\//);
  const targetFeature = requested.match(/^@\/features\/([^/]+)(?:\/(.+))?$/);
  if (insideShared && (requested.startsWith('@/features/') || requested.startsWith('@/app/'))) {
    return 'Shared modules cannot depend on features or route modules';
  }
  if (featureMatch && requested.startsWith('@/app/')) {
    return 'Feature modules cannot depend on Next route modules';
  }
  if (featureMatch && targetFeature && featureMatch[1] !== targetFeature[1] && targetFeature[2]) {
    return 'Cross-feature imports must use the feature public index';
  }
  return null;
}

export function resolvedBoundaryError(importer, target) {
  const from = importer.replaceAll('\\', '/');
  const to = target.replaceAll('\\', '/');
  if (from.startsWith('shared/') && (to.startsWith('features/') || to.startsWith('app/'))) {
    return 'Shared modules cannot depend on features or route modules';
  }
  if (from.startsWith('features/') && to.startsWith('app/')) {
    return 'Features cannot depend on route modules';
  }
  const fromFeature = from.match(/^features\/([^/]+)\//);
  const toFeature = to.match(/^features\/([^/]+)\//);
  if (fromFeature && toFeature && fromFeature[1] !== toFeature[1] && !/^features\/[^/]+\/index\.tsx?$/.test(to)) {
    return 'Cross-feature imports must go through the public index';
  }
  return null;
}

export function findCycle(graph) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  function dfs(node) {
    if (visiting.has(node)) return [...stack.slice(stack.indexOf(node)), node];
    if (visited.has(node)) return null;
    visiting.add(node);
    stack.push(node);
    for (const dependency of graph.get(node) || []) {
      const cycle = dfs(dependency);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  }
  for (const node of graph.keys()) {
    const cycle = dfs(node);
    if (cycle) return cycle;
  }
  return null;
}

function walk(directory) {
  const discovered = [];
  if (!fs.existsSync(directory)) return discovered;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) discovered.push(...walk(candidate));
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) discovered.push(candidate);
  }
  return discovered;
}

function resolveSource(importer, specifier) {
  const base = specifier.startsWith('@/')
    ? path.join(srcRoot, specifier.slice(2))
    : specifier.startsWith('.')
      ? path.resolve(path.dirname(importer), specifier)
      : null;
  if (!base) return null;
  for (const candidate of [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

export function inspectArchitecture() {
  const files = walk(srcRoot);
  const graph = new Map();
  const errors = [];
  for (const file of files) {
    const relativeFile = path.relative(srcRoot, file).replaceAll('\\', '/');
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const edges = new Set();
    for (const statement of source.statements) {
      if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))) continue;
      if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const request = statement.moduleSpecifier.text;
      const error = boundaryError(relativeFile, request);
      if (error) errors.push(relativeFile + ': ' + error + ' (' + request + ')');
      const target = resolveSource(file, request);
      if (target) {
        const targetRelative = path.relative(srcRoot, target).replaceAll('\\', '/');
        const resolvedError = resolvedBoundaryError(relativeFile, targetRelative);
        if (resolvedError && resolvedError !== error) {
          errors.push(relativeFile + ': ' + resolvedError + ' (' + request + ')');
        }
        edges.add(target);
      }
    }
    graph.set(file, [...edges]);
  }
  const cycle = findCycle(graph);
  if (cycle) errors.push('Circular dependency: ' + cycle.map(file => path.relative(srcRoot, file)).join(' → '));
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = inspectArchitecture();
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log('Architecture boundaries and cycles: OK');
  }
}
