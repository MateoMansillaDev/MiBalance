import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

// Solo para pruebas de integración. La clave administrativa se usa para retirar las identidades creadas por la prueba.
export function localInstance() {
  const cli = import.meta.resolve('supabase/dist/supabase.js');
  const status = JSON.parse(
    execFileSync(
      process.execPath,
      [fileURLToPath(cli), 'status', '-o', 'json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ),
  );
  if (status.API_URL !== 'http://127.0.0.1:55321')
    throw new Error('Las pruebas requieren la instancia local de MiBalance.');
  const client = (key) =>
    createClient(status.API_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  return {
    url: status.API_URL,
    key: status.PUBLISHABLE_KEY,
    publicClient: () => client(status.PUBLISHABLE_KEY),
    admin: client(status.SECRET_KEY),
  };
}
