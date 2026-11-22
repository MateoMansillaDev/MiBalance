'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import ui from '@/components/ui.module.scss';
import { PREFS, readPref, writePref } from '@/lib/preferences';
import s from './balances.module.scss';

type Row = { id: string; name: string; amount: string };

// Ocultar tapa los importes en pantalla (como un campo de contraseña): no se
// renderizan en el DOM ni los anuncia un lector de pantalla.
function Amount({ value, hidden }: { value: string; hidden: boolean }) {
  return hidden ? (
    <span className={s.masked}>
      <span aria-hidden="true">$ ••••••</span>
      <span className={ui.sr}>Importe oculto</span>
    </span>
  ) : (
    <span>{value}</span>
  );
}

export function AccountBalances({
  total,
  details,
  rows,
  cards,
}: {
  total: string;
  details: string[];
  rows: Row[];
  cards: Row[];
}) {
  const [hidden, setHidden] = useState(() => readPref(PREFS.hideBalances) === '1');
  function toggle() {
    const next = !hidden;
    setHidden(next);
    writePref(PREFS.hideBalances, next ? '1' : '0');
  }
  const Icon = hidden ? Eye : EyeOff;
  return (
    <section
      className={[ui.panel, s.balances].join(' ')}
      aria-labelledby="balances-title"
    >
      <div className={ui.between}>
        <h2 id="balances-title">Dinero en tus cuentas</h2>
        <button
          type="button"
          className={ui.secondary}
          onClick={toggle}
          aria-pressed={hidden}
        >
          <Icon size={18} aria-hidden="true" />
          {hidden ? 'Mostrar importes' : 'Ocultar importes'}
        </button>
      </div>
      <p>Saldo disponible hoy, sumando tus cuentas en pesos.</p>
      <strong className={s.total}>
        <Amount value={total} hidden={hidden} />
      </strong>
      {!hidden &&
        details.map((line) => (
          <p key={line} className={s.detail}>
            {line}
          </p>
        ))}
      {rows.length ? (
        <ul className={s.list}>
          {rows.map((row) => (
            <li key={row.id}>
              <span>{row.name}</span>
              <Amount value={row.amount} hidden={hidden} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={ui.empty}>
          <Link href="/cuentas?nueva=1">Creá tu primera cuenta</Link>
        </p>
      )}
      {cards.length > 0 && (
        <>
          <h3 className={s.subtitle}>Deuda en tarjetas</h3>
          <ul className={s.list}>
            {cards.map((row) => (
              <li key={row.id}>
                <span>{row.name}</span>
                <Amount value={row.amount} hidden={hidden} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
