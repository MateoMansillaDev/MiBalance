import Link from 'next/link';
import ui from '@/components/ui.module.scss';
export default function NotFound() {
  return (
    <main className={ui.errorPage}>
      <h1>Registro no disponible</h1>
      <p>Revisá el enlace o volvé a tu espacio.</p>
      <Link className={ui.secondary} href="/resumen">
        Volver al resumen
      </Link>
    </main>
  );
}
