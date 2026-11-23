'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useBook } from '@/local/store';
import {
  accountBalances,
  budgetProgress,
  filteredHistory,
  monthlyTotals,
  periodSummary,
  ruleSchedule,
} from '@/local/views';
import { useTitle, withSuspense } from '@/lib/page';
import { PREFS, readPref } from '@/lib/preferences';
import { Comparison } from '@/features/ledger/Comparison';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  ChartNoAxesCombined,
} from 'lucide-react';
import { Heading } from '@/components/Heading';
import { MovementList } from '@/features/ledger/MovementList';
import {
  Changes,
  Projection,
  Trend,
  Upcoming,
  insightStyles,
} from '@/features/insights/Insights';
import {
  categoryChanges,
  occurrences,
  pendingRecurring,
  type Occurrence,
} from '@/lib/insights';
import { categoryColor } from '@/lib/categoryIcons';
import { AccountBalances } from '@/features/ledger/AccountBalances';
import {
  addDays,
  addMonths,
  dateLabel,
  today,
  period,
  monthLabel,
  previousMonth,
  validDate,
} from '@/lib/dates';
import { money, percent, usdToArs } from '@/lib/money';
import { summarize } from '@/lib/summary';
import { budgetStatus } from '@/lib/budget';
import ui from '@/components/ui.module.scss';
import s from './dashboard.module.scss';

export default withSuspense(function Dashboard() {
  useTitle('Resumen');
  const book = useBook();
  const search = useSearchParams();
  const mes = search.get('mes') ?? undefined;
  const comparar = search.get('comparar') ?? undefined;
  const showComparison = readPref(PREFS.compare) !== 'hide';
  const month = mes || today().slice(0, 7);
  if (!validDate(month + '-01'))
    return (
      <>
        <Heading title="Resumen" />
        <p role="alert">
          El mes indicado es inválido.{' '}
          <Link href="/resumen">Ver mes actual</Link>
        </p>
      </>
    );
  const { start, end } = period(month);
  const now = today();
  const isCurrent = month === now.slice(0, 7);
  const soon = addDays(now, 7);
  const prior = previousMonth(month);
  const trendStart = addMonths(start, -5);
  const groups = periodSummary(book, start, end);
  const recent = { rows: filteredHistory(book, { desde: start, hasta: end }).slice(0, 5) };
  const limits = budgetProgress(book, month);
  const wallets = accountBalances(book);
  const rate = book.rate();
  const trend = monthlyTotals(book, trendStart, end);
  const before = prior ? periodSummary(book, period(prior).start, period(prior).end) : [];
  const future = { rows: filteredHistory(book, { desde: addDays(now, 1), hasta: soon }, true).slice(0, 20) };
  const rules = ruleSchedule(book);

  // Saldos: pesos disponibles, dólares estimados con la cotización y deuda de tarjetas.
  const sum = (list: typeof wallets) =>
    list.reduce((total, a) => total + BigInt(a.balance_cents), 0n);
  const pesoAccounts = wallets.filter(
    (a) => a.currency === 'ARS' && a.kind !== 'credit',
  );
  const dollarAccounts = wallets.filter(
    (a) => a.currency === 'USD' && a.kind !== 'credit',
  );
  const cardAccounts = wallets.filter((a) => a.kind === 'credit');
  const dollars = sum(dollarAccounts);
  const rateCents = rate ? BigInt(rate.ars_cents_per_usd) : null;
  const totalBalance =
    sum(pesoAccounts) + (rateCents ? usdToArs(dollars, rateCents) : 0n);
  const balanceDetails = dollarAccounts.length
    ? [
        rate && rateCents
          ? 'Incluye ' +
            money(dollars, 'USD') +
            ' estimados a ' +
            money(rateCents) +
            ' por US$ 1 (cotización del ' +
            dateLabel(rate.updated_on) +
            ').'
          : 'Además tenés ' +
            money(dollars, 'USD') +
            '. Cargá una cotización en Cuentas para sumarlos.',
      ]
    : [];

  // Próximos 7 días: repeticiones que todavía no se registraron y movimientos con fecha futura.
  const upcoming: Occurrence[] = [
    ...rules.flatMap((rule) => occurrences(rule, soon)),
    ...future.rows.map((row) => ({
      date: row.occurred_on,
      type: row.type,
      amount_cents: BigInt(row.amount_cents),
      currency: row.currency,
      label:
        (row.description || row.category_name) +
        (row.installment_count
          ? ' (cuota ' + row.installment_number + '/' + row.installment_count + ')'
          : ''),
    })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);
  const pending = pendingRecurring(rules, end);
  const alerts = limits.filter(
    (b) => BigInt(b.spent_cents) * 5n >= BigInt(b.limit_cents) * 4n,
  );
  const data = summarize(groups);
  const previousData = summarize(before);
  const changes = categoryChanges(
    data.categories.map(([n, v]) => [n, v]),
    previousData.categories.map(([n, v]) => [n, v]),
  );
  const totalsByMonth = new Map(trend.map((m) => [m.month, m]));
  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const key = addMonths(trendStart, i).slice(0, 7);
    const found = totalsByMonth.get(key);
    return {
      month: key,
      income: BigInt(found?.income ?? 0),
      expense: BigInt(found?.expense ?? 0),
    };
  });
  const weeks = data.weeks.slice(0, Math.ceil(Number(end.slice(-2)) / 7));
  const max = weeks.reduce(
    (largest, w) =>
      [largest, w.income, w.expense].reduce((a, b) => (a > b ? a : b)),
    0n,
  );
  return (
    <>
      <Heading title="Resumen" description={monthLabel(month)}>
        <form className={ui.actions}>
          {comparar && <input type="hidden" name="comparar" value={comparar} />}
          <label className={ui.sr} htmlFor="month">
            Mes del resumen
          </label>
          <input
            id="month"
            type="month"
            name="mes"
            defaultValue={month}
            required
          />
          <button className={ui.secondary}>Ver mes</button>
        </form>
      </Heading>
      {alerts.length > 0 && (
        <section className={ui.notice} aria-label="Alertas de presupuesto">
          <h2>Alertas de presupuesto</h2>
          <ul>
            {alerts.map((b) => (
              <li key={b.id}>
                {b.name} ·{' '}
                {budgetStatus(BigInt(b.spent_cents), BigInt(b.limit_cents))} ·{' '}
                {money(b.spent_cents)} de {money(b.limit_cents)}
              </li>
            ))}
          </ul>
          <Link href={'/planificacion?mes=' + month}>Revisar presupuestos</Link>
        </section>
      )}
      <AccountBalances
        total={money(totalBalance)}
        details={balanceDetails}
        rows={[...pesoAccounts, ...dollarAccounts].map((a) => ({
          id: a.id,
          name: a.name,
          amount: money(a.balance_cents, a.currency),
        }))}
        cards={cardAccounts.map((a) => {
          const balance = BigInt(a.balance_cents);
          return {
            id: a.id,
            name: a.name,
            amount: money(balance < 0n ? -balance : 0n, a.currency),
          };
        })}
      />
      <div className={s.metrics}>
        {[
          {
            title: 'Saldo neto del mes',
            value: data.net,
            icon: ChartNoAxesCombined,
            style: s.net,
          },
          {
            title: 'Ingresos',
            value: data.income,
            icon: ArrowDownLeft,
            style: s.income,
          },
          {
            title: 'Gastos',
            value: data.expense,
            icon: ArrowUpRight,
            style: s.expense,
          },
        ].map(({ title, value, icon: Icon, style }) => (
          <section key={title} className={style}>
            <div>
              <span>{title}</span>
              <Icon size={20} />
            </div>
            <strong>{money(value)}</strong>
          </section>
        ))}
      </div>
      <div className={insightStyles.pair}>
        {isCurrent && (
          <Projection
            net={data.net}
            pendingIncome={pending.income}
            pendingExpense={pending.expense}
          />
        )}
        <Upcoming items={upcoming} />
      </div>
      <div className={s.charts}>
        <section className={ui.panel}>
          <h2>Ingresos y gastos</h2>
          <p>Por semana del mes</p>
          {max === 0n ? (
            <div className={ui.empty}>
              El gráfico se completa al registrar un movimiento.
            </div>
          ) : (
            <>
              <div className={s.legend}>
                <span>Ingresos</span>
                <span>Gastos</span>
              </div>
              <div className={s.plot} aria-hidden="true">
                {weeks.map((w, i) => (
                  <div key={i}>
                    <div>
                      <i style={{ height: percent(w.income, max) + '%' }} />
                      <i style={{ height: percent(w.expense, max) + '%' }} />
                    </div>
                    <small>Sem. {i + 1}</small>
                  </div>
                ))}
              </div>
              <details>
                <summary>Ver importes por semana</summary>
                <ul>
                  {weeks.map((w, i) => (
                    <li key={i}>
                      Semana {i + 1} · Ingresos {money(w.income)} · Gastos{' '}
                      {money(w.expense)}
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
        </section>
        <section className={ui.panel}>
          <h2>Gastos por categoría</h2>
          <p>Distribución del mes</p>
          {data.categories.length ? (
            <ul className={s.categories}>
              {data.categories.map(([name, value, color]) => (
                <li key={name}>
                  <div>
                    <strong>
                      <i
                        className={ui.swatch}
                        style={{ background: categoryColor(name, color) }}
                        aria-hidden="true"
                      />
                      {name}
                    </strong>
                    <span>{money(value)}</span>
                  </div>
                  <progress
                    aria-label={'Participación de ' + name}
                    max={100}
                    value={percent(value, data.expense)}
                    style={{ accentColor: categoryColor(name, color) }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className={ui.empty}>Todavía no hay gastos en este mes.</div>
          )}
        </section>
      </div>
      <div className={insightStyles.pair}>
        <Trend months={trendMonths} />
        {prior && <Changes changes={changes} reference={prior} />}
      </div>
      <section className={ui.panel}>
        <div className={ui.between}>
          <h2>Últimos movimientos</h2>
          <Link
            className={ui.textLink}
            href={'/movimientos?desde=' + start + '&hasta=' + end}
          >
            Ver historial <ArrowRight size={15} />
          </Link>
        </div>
        <MovementList
          rows={recent.rows}
          empty="Todavía no registraste movimientos en este mes."
        />
      </section>
      {(showComparison || comparar) && (
        <Comparison month={month} reference={comparar} current={data} />
      )}
    </>
  );
});
