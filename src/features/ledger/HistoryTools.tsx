'use client';
import Link from 'next/link';
import { useState } from 'react';
import { MutationForm } from '@/components/MutationForm';
import { removePlanItem, saveFilter } from '@/local/actions';
import { useBook } from '@/local/store';
import { filteredTotals } from '@/local/views';
import { filterQuery, historyFilters, type Filters } from './filters';
import { encodeCsv } from '@/features/csv/format';
import { money } from '@/lib/money';
import { CSV_ROWS } from '@/features/csv/limits';
import type { Movement } from '@/lib/domain';
import ui from '@/components/ui.module.scss';
import s from '@/features/planning/planning.module.scss';

// El CSV intercambia importes en pesos; las cuentas en dólares quedan afuera.
function download(rows: Movement[], block: number) {
  const pesos = rows.filter((r) => r.currency === 'ARS');
  const slice = pesos.slice((block - 1) * CSV_ROWS, block * CSV_ROWS);
  const url = URL.createObjectURL(
    new Blob([encodeCsv(slice)], { type: 'text/csv;charset=utf-8' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mibalance-' + block + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function HistoryTools({ filters, rows }: { filters: Filters; rows: Movement[] }) {
  const book = useBook();
  const saved = book.live('filters').sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const report = filteredTotals(rows);
  const query = filterQuery(filters);
  const pesoCount = rows.filter((r) => r.currency === 'ARS').length;
  const blocks = Math.max(1, Math.ceil(pesoCount / CSV_ROWS));
  const [block, setBlock] = useState(1);
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
          <dd>{money(report.income - report.expense)}</dd>
        </div>
      </dl>
      <div className={s.tools}>
        {blocks > 1 && (
          <label>
            Lote CSV (1–{blocks}){' '}
            <input
              type="number"
              min="1"
              max={blocks}
              value={block}
              onChange={(e) => setBlock(Math.min(blocks, Math.max(1, Number(e.target.value) || 1)))}
            />
          </label>
        )}
        <button type="button" className={ui.secondary} onClick={() => download(rows, block)}>
          Exportar CSV
        </button>
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
                  filterQuery(historyFilters(Object.fromEntries(new URLSearchParams(f.query))))
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
