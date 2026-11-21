import Link from 'next/link';
import { Heading } from '@/components/Heading';
import { accounts, allRows } from '@/features/ledger/queries';
import { requireUser } from '@/lib/supabase/server';
import { addMonths, monthLabel, today } from '@/lib/dates';
import { money } from '@/lib/money';
import ui from '@/components/ui.module.scss';
import s from '@/features/planning/planning.module.scss';
export const metadata = { title: 'Tarjetas' };

type Row = { account_id: string; occurred_on: string; amount_cents: string };
export default async function Cards() {
  const { db, user } = await requireUser();
  const cards = (await accounts()).filter((a) => a.kind === 'credit');
  const start = today().slice(0, 7) + '-01';
  const rows = cards.length
    ? await allRows<Row>((offset) =>
        db
          .from('transactions')
          .select('account_id,occurred_on,amount_cents::text')
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .in(
            'account_id',
            cards.map((c) => c.id),
          )
          .gte('occurred_on', start)
          .order('occurred_on')
          .order('id')
          .range(offset, offset + 199)
          .returns<Row[]>(),
      )
    : [];
  const months = Array.from({ length: 6 }, (_, i) =>
    addMonths(start, i).slice(0, 7),
  );
  return (
    <>
      <Heading
        title="Tarjetas"
        description="Lo que debés y las cuotas que vienen, mes por mes."
      >
        <Link href="/cuentas" className={ui.secondary}>
          Ver cuentas
        </Link>
      </Heading>
      {!cards.length ? (
        <div className={ui.empty}>
          <p>Todavía no tenés tarjetas de crédito.</p>
          <Link href="/cuentas?nueva=1">
            Crear una cuenta del tipo Tarjeta de crédito
          </Link>
        </div>
      ) : (
        <div className={ui.catalog}>
          {cards.map((card) => {
            const balance = BigInt(card.balance_cents);
            const byMonth = new Map<string, bigint>();
            for (const r of rows)
              if (r.account_id === card.id) {
                const m = r.occurred_on.slice(0, 7);
                byMonth.set(m, (byMonth.get(m) ?? 0n) + BigInt(r.amount_cents));
              }
            return (
              <article key={card.id} className={ui.panel}>
                <h2>{card.name}</h2>
                <p>
                  {balance < 0n
                    ? 'Deuda total, incluidas las cuotas futuras'
                    : 'Sin deuda pendiente'}
                </p>
                <strong className={ui.figure}>
                  {money(balance < 0n ? -balance : 0n, card.currency)}
                </strong>
                <ul className={s.rows} aria-label={'Cuotas de ' + card.name}>
                  {months.map((m) => (
                    <li key={m}>
                      <div>
                        <strong>{monthLabel(m)}</strong>
                        <span>{money(byMonth.get(m) ?? 0n, card.currency)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      )}
      <p className={[ui.panel, ui.sectionGap].join(' ')}>
        Para pagar el resumen, registrá una{' '}
        <Link href="/cuentas/transferencias">transferencia</Link> desde tu banco
        a la tarjeta: baja la deuda sin contarse como un gasto nuevo. Las
        compras en cuotas se cargan desde Agregar movimiento eligiendo la
        tarjeta.
      </p>
    </>
  );
}
