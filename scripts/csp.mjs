// Después de `next build`: agrega la política de seguridad a cada página de out/.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { addCsp } from './csp-lib.mjs';

async function* pages(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* pages(full);
    else if (entry.name.endsWith('.html')) yield full;
  }
}
let count = 0;
for await (const file of pages(path.resolve('out'))) {
  await writeFile(file, addCsp(await readFile(file, 'utf8')));
  count++;
}
if (!count) throw new Error('No hay páginas en out/. Corré next build primero.');
console.log('Política de seguridad agregada a ' + count + ' páginas.');
