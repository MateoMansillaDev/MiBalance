import { describe, it, expect } from 'vitest';
import { encodeCsv, decodeCsv } from '@/features/csv/format';
import { csvColumns } from '@/features/csv/limits';
import type { Category, Movement } from '@/lib/domain';
const a = { id: '00000000-0000-4000-8000-000000000001', name: 'Cuenta; banco' };
const c: Category = {
  id: '00000000-0000-4000-8000-000000000002',
  name: '=Categoría',
  type: 'expense',
};
const row: Movement = {
  id: '00000000-0000-4000-8000-000000000003',
  account_id: a.id,
  category_id: c.id,
  account_name: a.name,
  category_name: c.name,
  type: 'expense',
  amount_cents: '9223372036854775807',
  occurred_on: '2024-02-29',
  description: '@Texto;"cita"\nsegunda línea',
};
describe('CSV de movimientos', () => {
  it('conserva identidad y centavos exactos, escapando celdas de texto y comillas', () => {
    const file = encodeCsv([row]);
    expect(file).toContain('"\'=Categoría"');
    expect(file).toContain('""cita""');
    expect(decodeCsv(file, [a], [c])[0]).toEqual({
      reference: row.id,
      type: 'expense',
      account_id: a.id,
      category_id: c.id,
      amount_cents: row.amount_cents,
      occurred_on: row.occurred_on,
      description: row.description,
    });
  });
  it.each(["'texto", "'=texto", '  =texto', 'café;té'])(
    'mantiene el texto literal %s',
    (description) => {
      expect(
        decodeCsv(encodeCsv([{ ...row, description }]), [a], [c])[0]
          .description,
      ).toBe(description.trim());
    },
  );
  it('indica el registro que se debe corregir', () => {
    expect(() =>
      decodeCsv(
        encodeCsv([row, { ...row, occurred_on: '2025-02-29' }]),
        [a],
        [c],
      ),
    ).toThrow(/Registro 2/);
    expect(() => decodeCsv(encodeCsv([row]), [], [c])).toThrow(
      /Cuenta desconocida/,
    );
    expect(() =>
      decodeCsv(encodeCsv([row]), [a], [{ ...c, type: 'income' }]),
    ).toThrow(/Categoría desconocida/);
  });
  it('rechaza cabeceras distintas, comillas rotas y lotes vacíos o excedidos', () => {
    expect(() => decodeCsv('a;b\n1;2', [a], [c])).toThrow(/Encabezado/);
    expect(() =>
      decodeCsv(csvColumns.join(';') + '\n"sin cierre', [a], [c]),
    ).toThrow(/inválido/);
    expect(() => decodeCsv(encodeCsv([]), [a], [c])).toThrow(/300/);
    expect(() => decodeCsv(encodeCsv(Array(301).fill(row)), [a], [c])).toThrow(
      /300/,
    );
  });
});
