import { money, percent } from '@/lib/money';
import { dateLabel, monthLabel, shortMonthLabel } from '@/lib/dates';
import type { CategoryChange, Occurrence } from '@/lib/insights';
import ui from '@/components/ui.module.scss';
import s from './insights.module.scss';

export { s as insightStyles };

export function Projection({
  net,
  pendingIncome,
  pendingExpense,
}: {
  net: bigint;
  pendingIncome: bigint;
  pendingExpense: bigint;
}) {
  const projected = net + pendingIncome - pendingExpense;
  return (
    <section className={ui.panel} aria-labelledby="projection-title">
      <h2 id="projection-title">Proyección de fin de mes</h2>
      <p>Cuánto te quedaría al cierre si se cumplen tus repeticiones.</p>
      <strong className={s.big}>{money(projected)}</strong>
      <ul className={s.list}>
        <li>
          <span>Neto registrado hasta hoy</span>
          <span>{money(net)}</span>
        </li>
        <li>
          <span>Ingresos recurrentes pendientes</span>
          <span>+{money(pendingIncome)}</span>
        </li>
        <li>
          <span>Gastos recurrentes pendientes</span>
          <span>−{money(pendingExpense)}</span>
        </li>
      </ul>
    </section>
  );
}

export function Upcoming({ items }: { items: Occurrence[] }) {
  return (
    <section className={ui.panel} aria-labelledby="upcoming-title">
      <h2 id="upcoming-title">Próximos 7 días</h2>
      <p>Repeticiones y cuotas que vencen esta semana.</p>
      {items.length ? (
        <ul className={s.list}>
          {items.map((o, i) => (
            <li key={o.date + o.label + i}>
              <span>
                {dateLabel(o.date).slice(0, 5)} · {o.label}
              </span>
              <span>
                {o.type === 'expense' ? '−' : '+'}
                {money(o.amount_cents, o.currency)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className={ui.empty}>No hay vencimientos en los próximos días.</div>
      )}
    </section>
  );
}

export function Trend({
  months,
}: {
  months: { month: string; income: bigint; expense: bigint }[];
}) {
  const max = months.reduce(
    (m, x) => [m, x.income, x.expense].reduce((a, b) => (a > b ? a : b)),
    0n,
  );
  return (
    <section className={ui.panel} aria-labelledby="trend-title">
      <h2 id="trend-title">Tendencia</h2>
      <p>Ingresos y gastos de los últimos 6 meses</p>
      {max === 0n ? (
        <div className={ui.empty}>Todavía no hay movimientos en este período.</div>
      ) : (
        <>
          <div className={s.trend} aria-hidden="true">
            {months.map((m) => (
              <div key={m.month}>
                <div className={s.bars}>
                  <i style={{ height: percent(m.income, max) + '%' }} />
                  <i style={{ height: percent(m.expense, max) + '%' }} />
                </div>
                <small>{shortMonthLabel(m.month)}</small>
              </div>
            ))}
          </div>
          <details>
            <summary>Ver importes por mes</summary>
            <ul>
              {months.map((m) => (
                <li key={m.month}>
                  {monthLabel(m.month)} · Ingresos {money(m.income)} · Gastos{' '}
                  {money(m.expense)} · Neto {money(m.income - m.expense)}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}

export function Changes({
  changes,
  reference,
}: {
  changes: CategoryChange[];
  reference: string;
}) {
  return (
    <section className={ui.panel} aria-labelledby="changes-title">
      <h2 id="changes-title">Qué cambió</h2>
      <p>Comparado con {monthLabel(reference)}, por categoría de gasto</p>
      {changes.length ? (
        <ul className={s.list}>
          {changes.map((c) => (
            <li key={c.name}>
              <span>
                {c.previous === 0n
                  ? c.name + ': nueva este mes'
                  : c.current === 0n
                    ? c.name + ': sin gastos este mes'
                    : c.name}
              </span>
              <span className={c.diff > 0n ? s.up : s.down}>
                {c.diff > 0n ? '+' : '−'}
                {money(c.diff > 0n ? c.diff : -c.diff)}
                {c.percent !== null &&
                  ' (' + (c.percent > 0 ? '+' : '') + c.percent.toLocaleString('es-AR') + ' %)'}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className={ui.empty}>Sin cambios para comparar todavía.</div>
      )}
    </section>
  );
}
