'use client';
import Link from 'next/link';
import { useBook } from '@/local/store';
import { accountBalances } from '@/local/views';
import { useTitle } from '@/lib/page';
import { Heading } from '@/components/Heading';
import { MutationForm } from '@/components/MutationForm';
import { removeItem, saveExchange } from '@/local/actions';
import { dateLabel, today } from '@/lib/dates';
import { money } from '@/lib/money';
import ui from '@/components/ui.module.scss';
import s from '@/features/planning/planning.module.scss';

type Exchange = {
  id: string;
  source_id: string;
  destination_id: string;
  source_currency: 'ARS' | 'USD';
  destination_currency: 'ARS' | 'USD';
  source_cents: string;
  destination_cents: string;
  occurred_on: string;
  description: string;
};
export default function Dollars() {
  useTitle('Compra y venta de dólares');
  const book = useBook();
  const list = accountBalances(book);
  const currencyOf = new Map(list.map((a) => [a.id, a.currency]));
  const history: Exchange[] = book
    .live('exchanges')
    .map((e) => ({
      ...e,
      source_currency: currencyOf.get(e.source_id) ?? 'ARS',
      destination_currency: currencyOf.get(e.destination_id) ?? 'ARS',
    }))
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.id.localeCompare(a.id));
  const names = new Map(list.map((a) => [a.id, a.name]));
  const hasBoth =
    list.some((a) => a.currency === 'ARS') &&
    list.some((a) => a.currency === 'USD');
  const options = list.map((a) => (
    <option key={a.id} value={a.id}>
      {a.name} ({a.currency})
    </option>
  ));
  return (
    <>
      <Heading
        title="Compra y venta de dólares"
        description="Pasá plata entre una cuenta en pesos y otra en dólares. No cuenta como ingreso ni gasto."
      >
        <Link href="/cuentas" className={ui.secondary}>
          Ver saldos
        </Link>
      </Heading>
      <section className={ui.panel}>
        <h2>Nueva operación</h2>
        {hasBoth ? (
          <MutationForm
            action={saveExchange}
            submit="Registrar operación"
            resetOnSuccess
          >
            <div className={ui.pair}>
              <label>
                Sale de
                <select name="source_id">{options}</select>
              </label>
              <label>
                Entra en
                <select name="destination_id">{options}</select>
              </label>
            </div>
            <div className={ui.pair}>
              <label>
                Importe que sale
                <input name="source_cents" inputMode="decimal" required />
              </label>
              <label>
                Importe que entra
                <input name="destination_cents" inputMode="decimal" required />
              </label>
            </div>
            <label>
              Fecha
              <input
                type="date"
                name="occurred_on"
                required
                defaultValue={today()}
              />
            </label>
            <label>
              Descripción (opcional)
              <input name="description" maxLength={500} />
            </label>
          </MutationForm>
        ) : (
          <p>
            Necesitás una cuenta en pesos y otra en dólares.{' '}
            <Link href="/cuentas?nueva=1">Crear una cuenta</Link>
          </p>
        )}
      </section>
      <section className={[ui.panel, ui.sectionGap].join(' ')}>
        <h2>Historial</h2>
        {history.length ? (
          <ul className={s.rows}>
            {history.map((e) => {
              const ars = BigInt(
                e.source_currency === 'ARS' ? e.source_cents : e.destination_cents,
              );
              const usd = BigInt(
                e.source_currency === 'USD' ? e.source_cents : e.destination_cents,
              );
              return (
                <li key={e.id}>
                  <div>
                    <strong>
                      {names.get(e.source_id)} → {names.get(e.destination_id)}
                    </strong>
                    <span>
                      {money(e.source_cents, e.source_currency)} →{' '}
                      {money(e.destination_cents, e.destination_currency)}
                    </span>
                  </div>
                  <p>
                    {dateLabel(e.occurred_on)} · {money((ars * 100n) / usd)} por
                    US$ 1{e.description && ' · ' + e.description}
                  </p>
                  <MutationForm
                    action={removeItem.bind(null, 'exchanges', e.id)}
                    submit="Eliminar operación"
                    confirm="¿Eliminar la operación y revertir su efecto en ambas cuentas?"
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={ui.empty}>Todavía no registraste operaciones.</p>
        )}
      </section>
    </>
  );
}
