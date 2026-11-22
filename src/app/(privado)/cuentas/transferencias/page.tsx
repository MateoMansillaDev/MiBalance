'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useBook } from '@/local/store';
import { accountBalances } from '@/local/views';
import { useTitle, withSuspense } from '@/lib/page';
import { Heading } from '@/components/Heading';
import { MutationForm } from '@/components/MutationForm';
import { TransferForm } from '@/features/accounts/TransferForm';
import { removeItem } from '@/local/actions';
import { dateLabel, today } from '@/lib/dates';
import { money } from '@/lib/money';
import ui from '@/components/ui.module.scss';
import s from '@/features/planning/planning.module.scss';

export default withSuspense(function Transfers() {
  useTitle('Transferencias');
  const book = useBook();
  const search = useSearchParams();
  const params = { pagina: search.get('pagina') ?? undefined, editar: search.get('editar') ?? undefined };
  const page = Number(params.pagina ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000000)
    return (
      <p role="alert">
        Página inválida.{' '}
        <Link href="/cuentas/transferencias">Volver al historial</Link>
      </p>
    );
  const list = accountBalances(book);
  const all = book
    .live('transfers')
    .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.id.localeCompare(a.id));
  const history = { data: all.slice((page - 1) * 20, page * 20), count: all.length };
  const names = new Map(list.map((a) => [a.id, a.name]));
  const currencyOf = new Map(list.map((a) => [a.id, a.currency]));
  const editing = params.editar ? (book.get('transfers', params.editar) ?? null) : null;
  return (
    <>
      <Heading
        title="Transferencias"
        description="Mové dinero entre tus cuentas. Los ingresos, gastos y el neto del período se mantienen."
      >
        <Link href="/cuentas" className={ui.secondary}>
          Ver saldos
        </Link>
      </Heading>
      <section className={ui.panel}>
        <h2>{editing ? 'Editar transferencia' : 'Nueva transferencia'}</h2>
        {editing && (
          <p>
            <Link href="/cuentas/transferencias">Cancelar la edición</Link>
          </p>
        )}
        {list.length >= 2 ? (
          <TransferForm
            key={editing?.id ?? 'nueva'}
            accounts={list.map(({ id, name, currency }) => ({
              id,
              name,
              currency,
            }))}
            date={today()}
            editing={editing ?? undefined}
          />
        ) : (
          <p>
            Necesitás dos cuentas.{' '}
            <Link href="/cuentas?nueva=1">Crear otra cuenta</Link>
          </p>
        )}
      </section>
      <section className={[ui.panel, ui.sectionGap].join(' ')}>
        <h2>Historial de transferencias</h2>
        {history.data.length ? (
          <ul className={s.rows}>
            {history.data.map((t) => (
              <li key={t.id}>
                <div>
                  <strong>
                    {names.get(t.source_id)} → {names.get(t.destination_id)}
                  </strong>
                  <span>
                    {money(
                      t.amount_cents,
                      currencyOf.get(t.source_id) ?? 'ARS',
                    )}
                  </span>
                </div>
                <p>
                  {dateLabel(t.occurred_on)}
                  {t.description && ' · ' + t.description}
                </p>
                <Link
                  href={'/cuentas/transferencias?editar=' + t.id}
                  className={ui.textLink}
                >
                  Editar transferencia
                </Link>
                <MutationForm
                  action={removeItem.bind(null, 'transfers', t.id)}
                  submit="Eliminar transferencia"
                  confirm="¿Eliminar la transferencia y revertir su efecto en ambas cuentas?"
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className={ui.empty}>No hay transferencias en esta página.</p>
        )}
        <nav className={ui.actions} aria-label="Páginas de transferencias">
          {page > 1 && <Link href={'?pagina=' + (page - 1)}>Anterior</Link>}
          {page * 20 < (history.count ?? 0) && (
            <Link href={'?pagina=' + (page + 1)}>Siguiente</Link>
          )}
        </nav>
      </section>
    </>
  );
});
