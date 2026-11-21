import Link from 'next/link';
import { Heading } from '@/components/Heading';
import { MutationForm } from '@/components/MutationForm';
import { TransferForm } from '@/features/accounts/TransferForm';
import { removeItem } from '@/features/accounts/advanced-actions';
import { accounts } from '@/features/ledger/queries';
import { requireUser } from '@/lib/supabase/server';
import { dateLabel, today } from '@/lib/dates';
import { money } from '@/lib/money';
import ui from '@/components/ui.module.scss';
import s from '@/features/planning/planning.module.scss';
export const metadata = { title: 'Transferencias' };

export default async function Transfers({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const page = Number((await searchParams).pagina ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000000)
    return (
      <p role="alert">
        Página inválida.{' '}
        <Link href="/cuentas/transferencias">Volver al historial</Link>
      </p>
    );
  const { db, user } = await requireUser();
  const [list, history] = await Promise.all([
    accounts(),
    db
      .from('transfers')
      .select(
        'id,source_id,destination_id,amount_cents::text,occurred_on,description',
        { count: 'exact' },
      )
      .eq('user_id', user.id)
      .order('occurred_on', { ascending: false })
      .order('id', { ascending: false })
      .range((page - 1) * 20, page * 20 - 1),
  ]);
  if (history.error)
    throw new Error('No se pudo consultar el historial de transferencias.');
  const names = new Map(list.map((a) => [a.id, a.name]));
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
        <h2>Nueva transferencia</h2>
        {list.length >= 2 ? (
          <TransferForm
            accounts={list.map(({ id, name }) => ({ id, name }))}
            date={today()}
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
                  <span>{money(t.amount_cents)}</span>
                </div>
                <p>
                  {dateLabel(t.occurred_on)}
                  {t.description && ' · ' + t.description}
                </p>
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
}
