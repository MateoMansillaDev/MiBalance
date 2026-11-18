import Link from 'next/link';
import { MutationForm } from '@/components/MutationForm';
import { saveFilter, removePlanItem } from '@/features/planning/actions';
import { filterQuery, historyFilters, type Filters } from './filters';
import { savedFilters, reportTotals } from './report';
import { money } from '@/lib/money';
import { CSV_ROWS } from '@/features/csv/limits';
import ui from '@/components/ui.module.scss';
import s from '@/features/planning/planning.module.scss';
export async function HistoryTools({
  filters,
  count,
}: {
  filters: Filters;
  count: number;
}) {
  const [saved, report] = await Promise.all([
    savedFilters(),
    reportTotals(filters),
  ]);
  const query = filterQuery(filters);
  const blocks = Math.max(1, Math.ceil(count / CSV_ROWS));
  return (
    <section className={[ui.panel, s.section].join(' ')} aria-label="Reporte del historial">
      <h2>Reporte filtrado</h2>
      <dl className={s.metrics}>
        <div>
          <dt>Ingresos</dt>
          <dd>{money(report.income)}</dd>
        </div>
        <div>
          <dt>Gastos</dt>
          <dd>{money(report.expense)}</dd>
        </div>
        <div>
          <dt>Neto</dt>
          <dd>{money(BigInt(report.income) - BigInt(report.expense))}</dd>
        </div>
      </dl>
      <div className={s.tools}>
        {blocks === 1 ? (
          <a className={ui.secondary} href={'/movimientos/exportar?' + query}>
            Exportar CSV
          </a>
        ) : (
          <form action="/movimientos/exportar" className={ui.actions}>
            {Array.from(new URLSearchParams(query)).map(([key, value]) => (
              <input type="hidden" key={key} name={key} value={value} />
            ))}
            <label>
              Lote CSV (1–{blocks}){' '}
              <input
                name="lote"
                type="number"
                min="1"
                max={blocks}
                defaultValue="1"
                required
              />
            </label>
            <button className={ui.secondary}>Exportar CSV</button>
          </form>
        )}
        <Link href="/movimientos/importar">Importar CSV</Link>
      </div>
      <details className={s.disclosure}>
        <summary>Filtros guardados ({saved.length})</summary>
        <MutationForm
          action={saveFilter.bind(null, query)}
          submit="Guardar filtros actuales"
          resetOnSuccess
        >
          <label>
            Nombre del filtro
            <input name="name" required maxLength={80} />
          </label>
          <p>Usá el mismo nombre para actualizar un filtro.</p>
        </MutationForm>
        <ul className={s.rows}>
          {saved.map((f) => (
            <li key={f.id}>
              <Link
                href={
                  '/movimientos?' +
                  filterQuery(
                    historyFilters(
                      Object.fromEntries(new URLSearchParams(f.query)),
                    ),
                  )
                }
              >
                {f.name}
              </Link>
              <MutationForm
                action={removePlanItem.bind(null, 'saved_filters', f.id)}
                submit="Quitar filtro"
                confirm={'¿Quitar el filtro ' + f.name + '?'}
              />
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
