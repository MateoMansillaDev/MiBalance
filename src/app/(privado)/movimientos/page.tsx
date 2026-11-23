'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Heading } from '@/components/Heading';
import { useBook } from '@/local/store';
import {
  accountBalances,
  categoryList,
  filteredHistory,
} from '@/local/views';
import { filterCriteria, historyFilters } from '@/features/ledger/filters';
import { paramsOf, useTitle, withSuspense } from '@/lib/page';
import { MovementList } from '@/features/ledger/MovementList';
import { HistoryTools } from '@/features/ledger/HistoryTools';
import ui from '@/components/ui.module.scss';
export default withSuspense(function HistoryPage() {
  useTitle('Movimientos');
  const book = useBook();
  const params = paramsOf(useSearchParams());
  const filters = historyFilters(params);
  const list = accountBalances(book);
  const tags = categoryList(book);
  const all = filters.invalid
    ? null
    : filteredHistory(book, filterCriteria(filters), filters.ascending);
  const result = all && {
    rows: all.slice((filters.page - 1) * 20, filters.page * 20),
    count: all.length,
  };
  function pageLink(page: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params))
      if (typeof value === 'string') query.set(key, value);
    query.set('pagina', String(page));
    return '/movimientos?' + query;
  }
  return (
    <>
      <Heading
        title="Movimientos"
        description="Buscá y consultá el historial de tus cuentas."
      />
      <form className={ui.filters}>
        <label>
          Buscar en la descripción
          <input
            type="search"
            name="q"
            maxLength={100}
            defaultValue={filters.q}
          />
        </label>
        <label>
          Desde
          <input name="desde" type="date" defaultValue={filters.start} />
        </label>
        <label>
          Hasta
          <input name="hasta" type="date" defaultValue={filters.end} />
        </label>
        <label>
          Tipo
          <select name="tipo" defaultValue={filters.type}>
            <option value="">Todos</option>
            <option value="income">Ingreso</option>
            <option value="expense">Gasto</option>
          </select>
        </label>
        <label>
          Cuenta
          <select name="cuenta" defaultValue={filters.account}>
            <option value="">Todas</option>
            {list.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Categoría
          <select name="categoria" defaultValue={filters.category}>
            <option value="">Todas</option>
            {tags.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.type === 'income' ? 'Ingreso' : 'Gasto'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Orden
          <select
            name="orden"
            defaultValue={filters.ascending ? 'asc' : 'desc'}
          >
            <option value="desc">Más recientes</option>
            <option value="asc">Más antiguos</option>
          </select>
        </label>
        <div className={ui.actions}>
          <button className={ui.secondary}>Aplicar filtros</button>
          <Link href="/movimientos">Limpiar</Link>
        </div>
      </form>
      {all && <HistoryTools filters={filters} rows={all} />}
      {result ? (
        <section className={ui.panel}>
          <h2>
            Historial <small>({result.count})</small>
          </h2>
          <MovementList
            rows={result.rows}
            empty="No hay movimientos para esta búsqueda."
          />
          <nav aria-label="Páginas del historial" className={ui.actions}>
            {filters.page > 1 && (
              <Link href={pageLink(filters.page - 1)}>Anterior</Link>
            )}
            {result.count > 0 && (
              <span>
                Página {filters.page} de {Math.ceil(result.count / 20)}
              </span>
            )}
            {filters.page * 20 < result.count && (
              <Link href={pageLink(filters.page + 1)}>Siguiente</Link>
            )}
          </nav>
        </section>
      ) : (
        <p role="alert" className={ui.notice}>
          Revisá los filtros. La fecha inicial debe ser anterior o igual a la
          final.
        </p>
      )}
    </>
  );
});
