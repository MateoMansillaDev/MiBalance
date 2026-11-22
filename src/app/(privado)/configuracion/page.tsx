'use client';
import { useState } from 'react';
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

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={[ui.panel, s.row].join(' ')}>
      <header>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      <div>{children}</div>
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
      <div className={s.list}>
        <Row
          title="Google Drive"
          description="Guardá tus datos en tu propio Drive, en una carpeta privada de la app, para usarlos en otros dispositivos y no perderlos. MiBalance no ve tus otros archivos."
        >
          <SyncPanel />
        </Row>
        <Row title="Apariencia" description="Se aplica al instante y solo en este dispositivo.">
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
        </Row>
        <Row
          title="Bloqueo con PIN"
          description="Pide un PIN al abrir MiBalance y tras 5 minutos en segundo plano. Protege la pantalla de este dispositivo."
        >
          <PinSettings />
        </Row>
        <Row
          title="Respaldo"
          description="Un archivo con todos tus datos. Al restaurarlo se combina con lo que ya tenés."
        >
          <BackupTools />
        </Row>
        <Row
          title="Instalar la app"
          description="En Chrome o Edge, usá Instalar desde el menú. En iPhone, Compartir → Agregar a inicio."
        >
          <div className={s.compact}>
            <span>Funciona sin conexión después de la primera visita.</span>
            <span>Pesos argentinos (ARS) · Zona horaria de Córdoba</span>
          </div>
        </Row>
      </div>
    </>
  );
}
