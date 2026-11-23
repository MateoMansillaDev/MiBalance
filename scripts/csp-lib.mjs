import { createHash } from 'node:crypto';

// Política de seguridad de contenido para cada página exportada. La app solo
// puede cargar código propio y el inicio de sesión de Google, y solo puede
// conectarse con Google (Drive y la cuenta). Los scripts que Next.js incrusta
// en cada página se permiten por su huella exacta, sin abrir 'unsafe-inline'.
export const GOOGLE = {
  scripts: ['https://accounts.google.com'],
  connect: [
    'https://www.googleapis.com',
    'https://accounts.google.com',
    'https://oauth2.googleapis.com',
  ],
  frames: ['https://accounts.google.com'],
  styles: ['https://accounts.google.com'],
};

const INLINE = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
export function inlineHashes(html) {
  const hashes = new Set();
  for (const [, body] of html.matchAll(INLINE))
    if (body.length) hashes.add("'sha256-" + createHash('sha256').update(body, 'utf8').digest('base64') + "'");
  return [...hashes];
}
export function policy(hashes) {
  return [
    "default-src 'self'",
    ['script-src', "'self'", ...hashes, ...GOOGLE.scripts].join(' '),
    // React aplica estilos por atributo (barras, colores de categoría).
    ['style-src', "'self'", "'unsafe-inline'", ...GOOGLE.styles].join(' '),
    "img-src 'self' data: blob:",
    "font-src 'self'",
    ['connect-src', "'self'", ...GOOGLE.connect].join(' '),
    ['frame-src', ...GOOGLE.frames].join(' '),
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
/** Inserta la política como primer elemento de <head>, antes de cualquier script. */
export function addCsp(html) {
  if (html.includes('http-equiv="Content-Security-Policy"')) return html;
  const meta = '<meta http-equiv="Content-Security-Policy" content="' + policy(inlineHashes(html)) + '"/>';
  const at = html.search(/<head[^>]*>/i);
  if (at < 0) throw new Error('Página sin <head>.');
  const end = html.indexOf('>', at) + 1;
  return html.slice(0, end) + meta + html.slice(end);
}
