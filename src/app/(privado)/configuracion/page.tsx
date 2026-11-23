'use client';
import { useState } from 'react';
import { Archive, Cloud, Lock, Palette, Smartphone, type LucideIcon } from 'lucide-react';
import { Heading } from '@/components/Heading';
import { PinSettings } from '@/components/PinSettings';
import { BackupTools } from '@/components/BackupTools';
import { SyncPanel } from '@/components/SyncPanel';
import { PREFS, readPref, writePref } from '@/lib/preferences';
import { useTitle } from '@/lib/page';
import ui from '@/components/ui.module.scss';
import s from './settings.module.scss';

function applyTheme(theme: string) {
  const root = document.documentElement;
  if (theme === 'dark' || theme === 'light') root.dataset.theme = theme;
  else delete root.dataset.theme;
}

function Card({
  icon: Icon,
  title,
  description,
  size,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  size: 'wide' | 'side' | 'half' | 'quarter';
  children: React.ReactNode;
}) {
  return (
    <section className={[ui.panel, s.card, s[size]].join(' ')} aria-label={title}>
      <div className={s.head}>
        <span className={ui.tile}>
          <Icon size={20} aria-hidden="true" />
        </span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className={s.body}>{children}</div>
    </section>
  );
}

export default function Settings() {
  useTitle('Configuración');
  const [theme, setTheme] = useState(() => readPref(PREFS.theme) ?? 'system');
  const [compare, setCompare] = useState(() => readPref(PREFS.compare) !== 'hide');
  return (
    <>
      <Heading title="Configuración" description="Preferencias de este dispositivo y tus datos." />
      <div className={s.grid}>
        <Card
          size="wide"
          icon={Cloud}
          title="Google Drive"
          description="Guardá tus datos en tu propio Drive, en una carpeta privada de la app, para usarlos en otros dispositivos y no perderlos. MiBalance no ve tus otros archivos."
        >
          <SyncPanel />
        </Card>
        <Card
          size="side"
          icon={Palette}
          title="Apariencia"
          description="Se aplica al instante en este dispositivo."
        >
          <div className={ui.form}>
            <label>
              Tema
              <select
                name="theme"
                value={theme}
                onChange={(e) => {
                  setTheme(e.target.value);
                  writePref(PREFS.theme, e.target.value);
                  applyTheme(e.target.value);
                }}
              >
                <option value="system">Según el sistema</option>
                <option value="light">Claro</option>
                <option value="dark">Oscuro</option>
              </select>
            </label>
            <label>
              <span>
                <input
                  type="checkbox"
                  name="comparison"
                  checked={compare}
                  onChange={(e) => {
                    setCompare(e.target.checked);
                    writePref(PREFS.compare, e.target.checked ? 'show' : 'hide');
                  }}
                />
                Mostrar comparativa mensual en Resumen
              </span>
            </label>
          </div>
        </Card>
        <Card
          size="half"
          icon={Lock}
          title="Bloqueo con PIN"
          description="Pide un PIN al abrir MiBalance y tras 5 minutos en segundo plano."
        >
          <PinSettings />
        </Card>
        <Card
          size="quarter"
          icon={Archive}
          title="Respaldo"
          description="Un archivo con todos tus datos. Al restaurarlo se combina con lo que ya tenés."
        >
          <BackupTools />
        </Card>
        <Card
          size="quarter"
          icon={Smartphone}
          title="Instalar la app"
          description="En Chrome o Edge: Instalar desde el menú. En iPhone: Compartir → Agregar a inicio."
        >
          <ul className={s.facts}>
            <li>
              <span>Sin conexión</span>
              <span>Sí</span>
            </li>
            <li>
              <span>Moneda</span>
              <span>ARS y USD</span>
            </li>
            <li>
              <span>Zona horaria</span>
              <span>Córdoba</span>
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}
