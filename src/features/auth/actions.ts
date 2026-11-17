'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { database } from '@/lib/supabase/server';
import { config } from '@/lib/supabase/config';

export type Feedback = { error?: string; message?: string };
export async function authenticate(
  register: boolean,
  _: Feedback,
  form: FormData,
): Promise<Feedback> {
  if (!config())
    return {
      error:
        'Configurá la URL y la clave publicable de Supabase en .env.local para continuar.',
    };
  const email = z.email().safeParse(String(form.get('email') ?? '').trim());
  const password = form.get('password');
  if (
    !email.success ||
    typeof password !== 'string' ||
    !password ||
    (register && password.length < 8)
  ) {
    return {
      error: register
        ? 'Ingresá un correo válido y una contraseña de al menos 8 caracteres.'
        : 'Revisá el correo y la contraseña.',
    };
  }
  try {
    const db = await database();
    const credentials = { email: email.data, password };
    const { data, error } = register
      ? await db.auth.signUp(credentials)
      : await db.auth.signInWithPassword(credentials);
    if (error) {
      if (error.status === 429)
        return {
          error: 'Hubo varios intentos. Esperá un momento y volvé a probar.',
        };
      if (!error.status || error.status >= 500)
        return { error: 'No pudimos conectar con Supabase. Volvé a intentar.' };
      return {
        error: register
          ? 'No pudimos crear la cuenta. Revisá los datos e intentá otra vez.'
          : 'Revisá tus datos y verificá que hayas confirmado el correo.',
      };
    }
    if (!data.session)
      return {
        message: 'Revisá tu correo para confirmar la cuenta y poder ingresar.',
      };
  } catch {
    return { error: 'No pudimos conectar con Supabase. Volvé a intentar.' };
  }
  redirect('/resumen');
}

export async function signOut() {
  const db = await database();
  const { error } = await db.auth.signOut({ scope: 'local' });
  if (error) throw new Error('No se pudo cerrar la sesión.');
  redirect('/ingresar');
}
