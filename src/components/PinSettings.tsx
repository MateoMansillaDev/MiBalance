'use client';
import { useState, useSyncExternalStore } from 'react';
import { checkPin, clearPin, lockNow, readPin, savePin, validPin } from '@/lib/pin';
import ui from './ui.module.scss';
import s from './pin.module.scss';

export function PinSettings() {
  const stored = useSyncExternalStore(
    (notify) => {
      window.addEventListener('storage', notify);
      return () => window.removeEventListener('storage', notify);
    },
    () => !!readPin(),
    () => null,
  );
  const [changed, setHasPin] = useState<boolean | null>(null);
  const hasPin = changed ?? stored;
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(form: FormData) {
    setError('');
    setMessage('');
    const current = String(form.get('current') ?? '');
    const pin = String(form.get('pin') ?? '');
    const repeat = String(form.get('repeat') ?? '');
    if (hasPin && !(await checkPin(current)))
      return setError('El PIN actual no es correcto.');
    if (form.get('intent') === 'remove') {
      clearPin();
      setHasPin(false);
      return setMessage('Quitaste el PIN de este dispositivo.');
    }
    if (!validPin(pin)) return setError('Usá entre 4 y 8 números.');
    if (pin !== repeat) return setError('Los dos PIN no coinciden.');
    await savePin(pin);
    setHasPin(true);
    setMessage('PIN guardado en este dispositivo.');
  }

  if (hasPin === null) return <p>Cargando…</p>;
  return (
    <form
      className={ui.form}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        if (submitter instanceof HTMLButtonElement && submitter.value)
          data.set('intent', submitter.value);
        void submit(data);
        event.currentTarget.reset();
      }}
    >
      <p>{hasPin ? 'PIN activado en este dispositivo.' : 'Sin PIN en este dispositivo.'}</p>
      <div className={s.fields}>
      {hasPin && (
        <label>
          PIN actual
          <input name="current" type="password" inputMode="numeric" maxLength={8} autoComplete="off" />
        </label>
      )}
        <label>
          {hasPin ? 'PIN nuevo' : 'PIN'} (4 a 8 números)
          <input name="pin" type="password" inputMode="numeric" maxLength={8} autoComplete="off" />
        </label>
        <label>
          Repetí el PIN
          <input name="repeat" type="password" inputMode="numeric" maxLength={8} autoComplete="off" />
        </label>
      </div>
      <div className={ui.actions}>
        <button className={ui.secondary} value="save">
          {hasPin ? 'Cambiar PIN' : 'Activar PIN'}
        </button>
        {hasPin && (
          <>
            <button className={ui.secondary} value="remove">
              Quitar PIN
            </button>
            <button
              type="button"
              className={ui.secondary}
              onClick={() => {
                lockNow();
                location.reload();
              }}
            >
              Bloquear ahora
            </button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className={ui.notice}>
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </form>
  );
}
