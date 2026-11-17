import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/supabase/server';
import { signOut } from '@/features/auth/actions';
import { Heading } from '@/components/Heading';
import ui from '@/components/ui.module.scss';
export const metadata = { title: 'Configuración' };
async function setTheme(form: FormData) {
  'use server';
  await requireUser();
  const theme = String(form.get('theme'));
  if (!['system', 'light', 'dark'].includes(theme)) return;
  (await cookies()).set('mb-theme', theme, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    maxAge: 31536000,
  });
  revalidatePath('/', 'layout');
}
export default async function Settings() {
  const { user } = await requireUser();
  const theme = (await cookies()).get('mb-theme')?.value ?? 'system';
  return (
    <>
      <Heading title="Configuración" />
      <div className={ui.catalog}>
        <section className={ui.panel}>
          <h2>Apariencia</h2>
          <form action={setTheme} className={ui.form}>
            <label>
              Tema
              <select name="theme" defaultValue={theme}>
                <option value="system">Según el sistema</option>
                <option value="light">Claro</option>
                <option value="dark">Oscuro</option>
              </select>
            </label>
            <button className={ui.secondary}>Guardar preferencia</button>
          </form>
        </section>
        <section className={ui.panel}>
          <h2>Tu sesión</h2>
          <p>{user.email}</p>
          <form action={signOut}>
            <button className={ui.secondary}>Cerrar sesión</button>
          </form>
        </section>
        <section className={ui.panel}>
          <h2>Preferencias regionales</h2>
          <p>Peso argentino (ARS)</p>
          <p>Zona horaria de Córdoba, Argentina</p>
        </section>
      </div>
    </>
  );
}
