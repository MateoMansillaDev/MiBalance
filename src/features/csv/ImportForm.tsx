'use client';
import { useRef, useState, useTransition } from 'react';
import { processCsv, type CsvResult } from './actions';
import { CSV_BYTES, csvColumns } from './limits';
import ui from '@/components/ui.module.scss';
import s from '@/features/planning/planning.module.scss';
export function ImportForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<CsvResult>();
  const [pending, start] = useTransition();
  function run(confirm: boolean) {
    if (!ref.current) return;
    const data = new FormData(ref.current);
    const file = data.get('file');
    if (!(file instanceof File) || !file.size || file.size > CSV_BYTES) {
      setState({ error: 'Elegí un archivo de hasta 850 kB.' });
      return;
    }
    const confirmation =
      confirm && state && 'preview' in state
        ? { digest: state.digest, skip: state.preview.map((row) => row.skip) }
        : undefined;
    if (confirm && !confirmation) return;
    start(async () => setState(await processCsv(data, confirmation)));
  }
  return (
    <section className={ui.panel}>
      <h2>Archivo de movimientos</h2>
      <p>
        Usá UTF-8, punto y coma y hasta 300 registros. Las cuentas y categorías
        deben existir. Dejá el ID vacío para un movimiento nuevo.
      </p>
      <p>
        <a
          download="plantilla-mibalance.csv"
          href={
            'data:text/csv;charset=utf-8,' +
            encodeURIComponent('\uFEFF' + csvColumns.join(';') + '\r\n')
          }
        >
          Descargar plantilla CSV
        </a>
      </p>
      <form
        className={ui.form}
        ref={ref}
        onSubmit={(e) => {
          e.preventDefault();
          run(false);
        }}
      >
        <label>
          Archivo CSV
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            disabled={pending}
            onChange={() => setState(undefined)}
          />
        </label>
        <div>
          <button className={ui.secondary} disabled={pending}>
            Ver vista previa
          </button>
        </div>
      </form>
      {pending && <p role="status">Procesando archivo…</p>}
      {state && 'error' in state && (
        <p role="alert" className={ui.notice}>
          {state.error}
        </p>
      )}
      {state && 'imported' in state && (
        <p role="status">
          Importados: {state.imported}. Duplicados omitidos: {state.duplicates}.
        </p>
      )}
      {state && 'preview' in state && (
        <>
          <h2>Vista previa</h2>
          <div className={s.preview}>
            <table>
              <thead>
                <tr>
                  {[
                    'Fecha',
                    'Tipo',
                    'Cuenta',
                    'Categoría',
                    'Importe',
                    'Descripción',
                    'Estado',
                  ].map((t) => (
                    <th scope="col" key={t}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.preview.map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td>{r.label}</td>
                    <td>{r.account}</td>
                    <td>{r.category}</td>
                    <td>{r.amount}</td>
                    <td>{r.note}</td>
                    <td>{r.skip ? 'Duplicado' : 'Nuevo'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className={ui.primary}
            disabled={pending || state.preview.every((r) => r.skip)}
            onClick={() => run(true)}
          >
            Confirmar importación
          </button>
        </>
      )}
    </section>
  );
}
