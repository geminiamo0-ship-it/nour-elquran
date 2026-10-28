import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'apps/web/out');
const port = Number(process.argv[2] ?? 3000);
if (!fs.existsSync(path.join(root, 'index.html'))) {
  throw new Error('Static Next.js export missing: run pnpm build first');
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
  '.pdf': 'application/pdf',
};

function fileFor(requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const relative = decoded.endsWith('/')
    ? decoded + 'index.html'
    : path.extname(decoded) ? decoded : decoded + '/index.html';
  const absolute = path.resolve(root, '.' + relative);
  if (!absolute.startsWith(root + path.sep)) return null;
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return null;
  return absolute;
}

http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  let target;
  try {
    target = fileFor(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }
  const missing = !target;
  target ??= path.join(root, '404.html');
  if (!fs.existsSync(target)) {
    res.writeHead(404).end('Not found');
    return;
  }
  const stat = fs.statSync(target);
  res.writeHead(missing ? 404 : 200, {
    'Content-Type': contentTypes[path.extname(target)] ?? 'application/octet-stream',
    'Content-Length': stat.size,
  });
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(target).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log('Static export server listening on http://127.0.0.1:' + port);
});
