// Servidor estático mínimo para probar la exportación (`out/`) con Playwright.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('out');
const port = Number(process.env.PORT ?? 3187);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};
async function resolveFile(urlPath) {
  const clean = path.normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  let file = path.join(root, clean);
  if (!file.startsWith(root)) return null;
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    await stat(file);
    return file;
  } catch {
    return null;
  }
}
createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const file = await resolveFile(url.pathname);
  const target = file ?? path.join(root, '404.html');
  try {
    const body = await readFile(target);
    res.writeHead(file ? 200 : 404, {
      'Content-Type': types[path.extname(target)] ?? 'application/octet-stream',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado. ¿Corriste npm run build?');
  }
}).listen(port, '127.0.0.1');
