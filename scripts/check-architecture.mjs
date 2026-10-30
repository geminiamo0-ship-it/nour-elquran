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
  if (source.startsWith('app/') && targetFeature && targetFeature[2]
    && !/^index(?:\.tsx?)?$/.test(targetFeature[2])) {
    return 'Route modules must import features through the public index';
  }
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
  if (from.startsWith('app/') && to.startsWith('features/')
    && !/^features\/[^/]+\/index\.tsx?$/.test(to)) {
    return 'Route modules must import features through the public index';
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

function resolveSource(importer, specifier, sourceRoot = srcRoot) {
  const base = specifier.startsWith('@/')
    ? path.join(sourceRoot, specifier.slice(2))
    : specifier.startsWith('.')
      ? path.resolve(path.dirname(importer), specifier)
      : null;
  if (!base) return null;
  // NodeNext-style relative .js/.jsx specifiers may resolve to TS/TSX source.
  // Check those sources too, otherwise a relative import can bypass boundaries.
  const jsSource = base.endsWith('.js')
    ? [base.slice(0, -3) + '.ts', base.slice(0, -3) + '.tsx']
    : base.endsWith('.jsx')
      ? [base.slice(0, -4) + '.tsx']
      : [];
  for (const candidate of [...jsSource, base, base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

// Inspect the TypeScript AST so lazy imports cannot bypass the same rules as static imports.
export function importSpecifiers(source) {
  const requests = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      requests.push(node.moduleSpecifier.text);
    }
    // TypeScript's legacy import Foo = require('module') is an import, not a CallExpression.
    // It must obey the same feature/route boundaries as static and lazy imports.
    if (ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression
      && ts.isStringLiteralLike(node.moduleReference.expression)) {
      requests.push(node.moduleReference.expression.text);
    }
    // TypeScript's type-only import('module').Type and typeof import('module')
    // are ImportTypeNodes, not dynamic import calls. They still create dependencies.
    if (ts.isImportTypeNode(node)
      && ts.isLiteralTypeNode(node.argument)
      && ts.isStringLiteralLike(node.argument.literal)) {
      requests.push(node.argument.literal.text);
    }
    if (ts.isCallExpression(node) && node.arguments.length === 1
      && ts.isStringLiteralLike(node.arguments[0])
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      requests.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return requests;
}

export function inspectArchitecture(sourceRoot = srcRoot) {
  const files = walk(sourceRoot);
  const graph = new Map();
  const errors = [];
  for (const file of files) {
    const relativeFile = path.relative(sourceRoot, file).replaceAll('\\', '/');
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const edges = new Set();
    for (const request of importSpecifiers(source)) {
      const error = boundaryError(relativeFile, request);
      if (error) errors.push(relativeFile + ': ' + error + ' (' + request + ')');
      const target = resolveSource(file, request, sourceRoot);
      if (target) {
        const targetRelative = path.relative(sourceRoot, target).replaceAll('\\', '/');
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
  if (cycle) errors.push('Circular dependency: ' + cycle.map(file => path.relative(sourceRoot, file)).join(' → '));
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
