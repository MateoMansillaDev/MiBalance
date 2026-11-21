import { summary } from './queries';
import { summarize } from '@/lib/summary';
import { monthLabel, period, previousMonth, validDate } from '@/lib/dates';
import { money } from '@/lib/money';
import ui from '@/components/ui.module.scss';
import s from './comparison.module.scss';

type Totals = { income: bigint; expense: bigint; net: bigint };
const rows = [
  ['income', 'Ingresos'],
  ['expense', 'Gastos'],
  ['net', 'Saldo neto'],
] as const;
export async function Comparison({
  month,
  reference,
  current,
}: {
  month: string;
  reference?: string;
  current: Totals;
}) {
  const other = reference ?? previousMonth(month);
  const valid = other && validDate(other + '-01') && other !== month;
  const range = valid ? period(other) : null;
  const prior = range && summarize(await summary(range.start, range.end));
  return (
    <section
      className={[ui.panel, ui.sectionGap].join(' ')}
      aria-label="Comparativa mensual"
    >
      <h2>Comparativa mensual</h2>
      <form className={ui.actions}>
        <input type="hidden" name="mes" value={month} />
        <label>
          Mes de referencia{' '}
          <input
            name="comparar"
            type="month"
            defaultValue={valid ? other : ''}
            required
          />
        </label>
        <button className={ui.secondary}>Comparar</button>
      </form>
      {prior && other ? (
        <div
          className={s.scroll}
          tabIndex={0}
          role="region"
          aria-label="Importes comparados"
        >
          <table>
            <caption>
              Diferencia entre {monthLabel(month)} y {monthLabel(other)}
            </caption>
            <thead>
              <tr>
                <th scope="col">Concepto</th>
                <th scope="col">{monthLabel(other)}</th>
                <th scope="col">{monthLabel(month)}</th>
                <th scope="col">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([key, label]) => (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  <td>{money(prior[key])}</td>
                  <td>{money(current[key])}</td>
                  <td>{money(current[key] - prior[key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p role="status">
          Elegí un mes de referencia válido y diferente al del resumen.
        </p>
      )}
    </section>
  );
}
