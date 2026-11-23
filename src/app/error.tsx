'use client';
import Link from 'next/link';
import ui from '@/components/ui.module.scss';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className={ui.errorPage}>
      <h1>Algo salió mal</h1>
      <p>Tus datos siguen guardados en este dispositivo. Probá de nuevo.</p>
      <button className={ui.primary} onClick={reset}>
        Reintentar
      </button>{' '}
      <Link href="/resumen/">Volver al resumen</Link>
    </main>
  );
}
