'use client';
import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { checkPin, clearPin, isUnlocked, lockNow, markUnlocked, readPin } from '@/lib/pin';
import { wipeDevice } from '@/local/store';
import ui from './ui.module.scss';
import s from './pin.module.scss';

const IDLE_MS = 5 * 60 * 1000;

// Pantalla de privacidad local. Los datos se dibujan recién después de decidir
// si hay que pedir el PIN: el HTML estático no contiene información financiera.
export function PinLock({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(() => !!readPin() && !isUnlocked());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fails, setFails] = useState(0);

  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (readPin() && hiddenAt && Date.now() - hiddenAt > IDLE_MS) {
        lockNow();
        setLocked(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  async function unlock(form: FormData) {
    if (fails >= 5) return;
    setBusy(true);
    const ok = await checkPin(String(form.get('pin') ?? ''));
    setBusy(false);
    if (ok) {
      markUnlocked();
      setFails(0);
      setError('');
      setLocked(false);
      return;
    }
    const next = fails + 1;
    setFails(next);
    if (next >= 5) {
      setError('Demasiados intentos. Esperá 30 segundos.');
      setTimeout(() => {
        setFails(0);
        setError('');
      }, 30000);
    } else setError('PIN incorrecto.');
  }

  if (!locked) return <>{children}</>;
  return (
    <div className={s.lock} role="dialog" aria-modal="true" aria-labelledby="pin-title">
      <form
        className={s.box}
        onSubmit={(event) => {
          event.preventDefault();
          void unlock(new FormData(event.currentTarget));
        }}
      >
        <span className={ui.tile}>
          <Lock size={21} />
        </span>
        <h1 id="pin-title">MiBalance está bloqueado</h1>
        <label>
          PIN
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            pattern="\d{4,8}"
            maxLength={8}
            required
            autoFocus
          />
        </label>
        {error && (
          <p role="alert" className={ui.notice}>
            {error}
          </p>
        )}
        <button className={ui.primary} disabled={busy || fails >= 5}>
          {busy ? 'Verificando…' : 'Desbloquear'}
        </button>
      </form>
      <button
        type="button"
        className={s.forgot}
        onClick={async () => {
          if (
            !window.confirm(
              'Sin el PIN no se puede verificar quién sos. ¿Borrar los datos de este dispositivo y el PIN? Si sincronizás con Google Drive, vas a poder recuperarlos desde ahí.',
            )
          )
            return;
          await wipeDevice();
          clearPin();
          setLocked(false);
        }}
      >
        Olvidé mi PIN
      </button>
    </div>
  );
}
