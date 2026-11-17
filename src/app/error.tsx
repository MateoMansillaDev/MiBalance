'use client';
import Link from 'next/link';
import ui from '@/components/ui.module.scss';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className={ui.errorPage}>
      <h1>No pudimos cargar tu espacio</h1>
      <p>Revisá la conexión y la configuración de Supabase.</p>
      <button className={ui.primary} onClick={reset}>
        Reintentar
      </button>{' '}
      <Link href="/ingresar">Volver al acceso</Link>
    </main>
  );
}
