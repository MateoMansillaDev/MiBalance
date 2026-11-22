'use client';
import { useState } from 'react';
import { Heading } from '@/components/Heading';
import { PinSettings } from '@/components/PinSettings';
import { BackupTools } from '@/components/BackupTools';
import { PREFS, readPref, writePref } from '@/lib/preferences';
import { useTitle } from '@/lib/page';
import ui from '@/components/ui.module.scss';

function applyTheme(theme: string) {
  const root = document.documentElement;
  if (theme === 'dark' || theme === 'light') root.dataset.theme = theme;
  else delete root.dataset.theme;
}

export default function Settings() {
  useTitle('Configuración');
  const [theme, setTheme] = useState(() => readPref(PREFS.theme) ?? 'system');
  const [compare, setCompare] = useState(() => readPref(PREFS.compare) !== 'hide');
  const [saved, setSaved] = useState(false);
  return (
    <>
      <Heading title="Configuración" />
      <div className={ui.catalog}>
        <section className={ui.panel}>
          <h2>Apariencia</h2>
          <form
            className={ui.form}
            onSubmit={(event) => {
              event.preventDefault();
              writePref(PREFS.theme, theme);
              writePref(PREFS.compare, compare ? 'show' : 'hide');
              applyTheme(theme);
              setSaved(true);
            }}
          >
            <label>
              Tema
              <select
                name="theme"
                value={theme}
                onChange={(e) => {
                  setTheme(e.target.value);
                  setSaved(false);
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
                    setSaved(false);
                  }}
                />{' '}
                Mostrar comparativa mensual en Resumen
              </span>
            </label>
            <button className={ui.secondary}>Guardar preferencia</button>
            {saved && <p role="status">Preferencias guardadas en este dispositivo.</p>}
          </form>
        </section>
        <section className={ui.panel}>
          <h2>Bloqueo con PIN</h2>
          <PinSettings />
        </section>
        <section className={ui.panel}>
          <h2>Tus datos</h2>
          <BackupTools />
        </section>
        <section className={ui.panel}>
          <h2>Instalar MiBalance</h2>
          <p>
            En Chrome o Edge, elegí instalar desde el menú del navegador. En
            Safari de iPhone, usá Compartir y Agregar a inicio.
          </p>
          <p>
            Tus datos se guardan en este dispositivo y la app funciona sin
            conexión después de la primera visita.
          </p>
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
