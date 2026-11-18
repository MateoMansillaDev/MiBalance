'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Tags,
  Settings,
  CalendarDays,
  LogOut,
  Plus,
  CircleUserRound,
} from 'lucide-react';
import { Brand } from './Brand';
import { signOut } from '@/features/auth/actions';
import ui from './ui.module.scss';
import s from './shell.module.scss';
const links = [
  { url: '/resumen', title: 'Resumen', icon: LayoutDashboard },
  { url: '/movimientos', title: 'Movimientos', icon: ArrowLeftRight },
  { url: '/planificacion', title: 'Planificación', icon: CalendarDays },
  { url: '/cuentas', title: 'Cuentas', icon: Wallet },
  { url: '/categorias', title: 'Categorías', icon: Tags },
  { url: '/configuracion', title: 'Configuración', icon: Settings },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className={s.shell}>
      <a className={s.skip} href="#contenido">
        Ir al contenido
      </a>
      <aside className={s.sidebar}>
        <Brand />
        <nav aria-label="Principal">
          {links.map(({ url, title, icon: Icon }) => (
            <Link
              key={url}
              href={url}
              aria-current={path.startsWith(url) ? 'page' : undefined}
            >
              <Icon size={19} />
              {title}
            </Link>
          ))}
        </nav>
        <form action={signOut} className={s.logout}>
          <button>
            <LogOut size={17} /> Cerrar sesión
          </button>
        </form>
      </aside>
      <div className={s.workspace}>
        <header className={s.top}>
          <div>
            <CircleUserRound size={19} /> Espacio personal
          </div>
          <Link className={ui.primary} href="/movimientos/nuevo">
            <Plus size={17} /> Agregar movimiento
          </Link>
        </header>
        <main id="contenido" tabIndex={-1} className={s.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
