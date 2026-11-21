'use client';
import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { signOut } from '@/features/auth/actions';
import {
  checkPin,
  clearPin,
  isUnlocked,
  lockNow,
  markUnlocked,
  readPin,
  syncCookie,
} from '@/lib/pin';
import ui from './ui.module.scss';
import s from './pin.module.scss';

const IDLE_MS = 5 * 60 * 1000;

export function PinLock({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [locked, setLocked] = useState(enabled);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fails, setFails] = useState(0);

  useEffect(() => {
    const hasPin = !!readPin();
    if (hasPin !== enabled) syncCookie(hasPin);
    const apply = () => setLocked(hasPin && !isUnlocked());
    apply();
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hasPin && hiddenAt && Date.now() - hiddenAt > IDLE_MS) {
        lockNow();
        apply();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled]);

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

  return (
    <>
      <div inert={locked} aria-hidden={locked || undefined}>
        {children}
      </div>
      {locked && (
        <div
          className={s.lock}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pin-title"
        >
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
          <form action={signOut} onSubmit={() => clearPin()}>
            <button className={s.forgot}>
              Olvidé mi PIN: cerrar sesión y quitarlo
            </button>
          </form>
        </div>
      )}
    </>
  );
}
