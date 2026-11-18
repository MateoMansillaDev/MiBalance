import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { config } from './config';

export async function database() {
  const env = config();
  if (!env) throw new Error('Falta configurar Supabase.');
  const jar = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(list) {
        // En los Server Components, el proxy ya se encargó de renovar la sesión.
        try {
          for (const { name, value, options } of list)
            jar.set(name, value, options);
        } catch {
          /* El almacén de cookies es de solo lectura durante el render. */
        }
      },
    },
  });
}

export const requireUser = cache(async () => {
  if (!config()) redirect('/ingresar');
  const db = await database();
  const { data, error } = await db.auth.getUser();
  if (error && (error.name === 'AuthRetryableFetchError' || (error.status ?? 0) >= 500))
    throw new Error('No se pudo verificar la sesión.');
  if (!data.user || data.user.is_anonymous) redirect('/ingresar');
  const init = await db.rpc('refresh_space');
  if (init.error) throw new Error('No se pudo abrir tu espacio.');
  return { db, user: data.user };
});
