'use client';
import { disconnect, syncNow, useSync } from '@/sync/sync';
import ui from './ui.module.scss';

const time = (ms: number) =>
  new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(ms);

export function SyncPanel() {
  const sync = useSync();
  if (!sync.available)
    return <p>La sincronización no está configurada en esta versión de MiBalance.</p>;
  return (
    <div className={ui.form}>
      <p>
        Guardá una copia de tus datos en <strong>tu propio Google Drive</strong>,
        en una carpeta privada de la app. MiBalance solo puede ver esa carpeta,
        nunca tus otros archivos. Así podés usar los mismos datos en tu celular
        y en tu compu, y recuperarlos si cambiás de dispositivo.
      </p>
      {sync.enabled ? (
        <>
          <p>
            Conectado{sync.email ? ' como ' + sync.email : ''}.
            {sync.lastSync && ' Última sincronización: ' + time(sync.lastSync) + '.'}
          </p>
          <div className={ui.actions}>
            <button
              type="button"
              className={ui.secondary}
              disabled={sync.status === 'syncing'}
              onClick={() => void syncNow(true)}
            >
              {sync.status === 'syncing' ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
            <button
              type="button"
              className={ui.secondary}
              onClick={() => {
                if (
                  window.confirm(
                    '¿Dejar de sincronizar en este dispositivo? Tus datos siguen acá y en tu Drive.',
                  )
                )
                  void disconnect();
              }}
            >
              Desconectar
            </button>
          </div>
        </>
      ) : (
        <div className={ui.actions}>
          <button
            type="button"
            className={ui.primary}
            disabled={sync.status === 'syncing'}
            onClick={() => void syncNow(true)}
          >
            {sync.status === 'syncing' ? 'Conectando…' : 'Conectar con Google Drive'}
          </button>
        </div>
      )}
      {sync.message && (
        <p role="alert" className={ui.notice}>
          {sync.message}
        </p>
      )}
    </div>
  );
}

/** Estado de la sincronización en la barra superior. */
export function SyncBadge() {
  const sync = useSync();
  if (!sync.available || !sync.enabled) return null;
  const label =
    sync.status === 'syncing'
      ? 'Sincronizando…'
      : sync.status === 'needs-login'
        ? 'Sincronizar con Drive'
        : sync.status === 'error'
          ? 'Reintentar sincronización'
          : 'Sincronizado';
  return (
    <button
      type="button"
      className={ui.secondary}
      disabled={sync.status === 'syncing'}
      onClick={() => void syncNow(true)}
      title={sync.message || undefined}
    >
      {label}
    </button>
  );
}
