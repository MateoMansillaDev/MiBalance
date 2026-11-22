'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useBook } from '@/local/store';
import {
  accountBalances,
  budgetProgress,
  categoryList,
  ruleSchedule,
} from '@/local/views';
import { useTitle, withSuspense } from '@/lib/page';
import { Heading } from '@/components/Heading';
import { MutationForm } from '@/components/MutationForm';
import { budgetStatus } from '@/lib/budget';
import { RuleForm } from '@/features/planning/RuleForm';
import { saveBudget, removePlanItem } from '@/local/actions';
import { today, monthLabel, validDate, dateLabel } from '@/lib/dates';
import { directions } from '@/lib/domain';
import { money, percent } from '@/lib/money';
import ui from '@/components/ui.module.scss';
import s from '@/features/planning/planning.module.scss';
export default withSuspense(function Planning() {
  useTitle('Planificación');
  const book = useBook();
  const date = today();
  const month = useSearchParams().get('mes') || date.slice(0, 7);
  if (!validDate(month + '-01'))
    return (
      <p role="alert">
        Mes inválido. <Link href="/planificacion">Ver mes actual</Link>
      </p>
    );
  const limits = budgetProgress(book, month);
  const schedule = ruleSchedule(book);
  const list = accountBalances(book);
  const tags = categoryList(book);
  const expenseTags = tags.filter((c) => c.type === 'expense');
  return (
    <>
      <Heading
        title="Planificación"
        description="Controlá tus límites de gasto y programá movimientos."
      >
        <Link href="/planificacion/metas" className={ui.secondary}>
          Metas de ahorro
        </Link>
      </Heading>
      <section className={[ui.panel, s.section].join(' ')}>
        <div className={ui.between}>
          <div>
            <h2>Presupuestos mensuales</h2>
            <p>{monthLabel(month)}</p>
          </div>
          <form className={ui.actions}>
            <label>
              Mes{' '}
              <input type="month" name="mes" required defaultValue={month} />
            </label>
            <button className={ui.secondary}>Ver mes</button>
          </form>
        </div>
        {limits.length ? (
          <ul className={s.rows}>
            {limits.map((b) => {
              const spent = BigInt(b.spent_cents),
                limit = BigInt(b.limit_cents),
                delta = limit - spent;
              return (
                <li key={b.id}>
                  <div>
                    <strong>{b.name}</strong>
                    <span>{budgetStatus(spent, limit)}</span>
                  </div>
                  <progress
                    aria-label={'Gasto de ' + b.name}
                    max={100}
                    value={Math.min(100, percent(spent, limit))}
                  />
                  <p>
                    {money(spent)} gastados de {money(limit)} ·{' '}
                    {delta < 0n ? 'Exceso' : 'Disponible'}{' '}
                    {money(delta < 0n ? -delta : delta)}
                  </p>
                  <MutationForm
                    action={removePlanItem.bind(null, 'budgets', b.id)}
                    submit="Quitar límite"
                    confirm={
                      '¿Quitar el presupuesto de ' + b.name + ' para este mes?'
                    }
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={ui.empty}>
            Todavía no definiste presupuestos para este mes.
          </p>
        )}
        <details className={s.disclosure}>
          <summary>Definir o actualizar un límite</summary>
          {expenseTags.length ? (
            <MutationForm action={saveBudget} submit="Guardar presupuesto">
              <input type="hidden" name="month" value={month} />
              <div className={ui.pair}>
                <label>
                  Categoría de gasto
                  <select name="category_id">
                    {expenseTags.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Límite mensual (ARS)
                  <input name="amount" inputMode="decimal" required />
                </label>
              </div>
            </MutationForm>
          ) : (
            <Link href="/categorias?nueva=1">Crear una categoría de gasto</Link>
          )}
        </details>
      </section>
      <section className={[ui.panel, s.section].join(' ')}>
        <h2>Movimientos recurrentes</h2>
        <p>
          Al abrir MiBalance se registran los vencimientos según la fecha de
          Córdoba.
        </p>
        {schedule.length ? (
          <ul className={s.rows}>
            {schedule.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{r.description || r.category_name}</strong>
                  <span>{money(r.amount_cents, r.currency)}</span>
                </div>
                <p>
                  {directions[r.type]} · {r.account_name} ·{' '}
                  {r.frequency === 'monthly' ? 'Mensual' : 'Semanal'} · Próximo{' '}
                  {dateLabel(r.next_due)}
                </p>
                <MutationForm
                  action={removePlanItem.bind(null, 'recurring_rules', r.id)}
                  submit="Finalizar repetición"
                  confirm="¿Finalizar los próximos vencimientos? Tus movimientos registrados se conservan."
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className={ui.empty}>
            Todavía no programaste movimientos recurrentes.
          </p>
        )}
        <details className={s.disclosure}>
          <summary>Programar una repetición</summary>
          <RuleForm
            accounts={list.map(({ id, name }) => ({ id, name }))}
            categories={tags}
            date={date}
          />
        </details>
      </section>
    </>
  );
});
