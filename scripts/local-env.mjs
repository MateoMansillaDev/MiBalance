import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(import.meta.resolve('supabase/dist/supabase.js'));
const status = JSON.parse(
  execFileSync(process.execPath, [cli, 'status', '-o', 'json'], {
    encoding: 'utf8',
  }),
);
if (status.API_URL !== 'http://127.0.0.1:55321' || !status.PUBLISHABLE_KEY) {
  throw new Error(
    'Primero iniciá la instancia local de MiBalance con npm run db:start.',
  );
}
const lines = [
  'NEXT_PUBLIC_SUPABASE_URL=' + status.API_URL,
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' + status.PUBLISHABLE_KEY,
];
try {
  writeFileSync('.env.local', lines.join('\n') + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  console.log('Configuración local guardada en .env.local.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('.env.local ya existe. Se conservó su configuración.');
}
