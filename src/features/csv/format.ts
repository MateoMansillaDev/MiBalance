import { parse } from 'csv-parse/sync';
import { csvColumns, CSV_ROWS } from './limits';
import { decimal } from '@/lib/money';
import {
  transactionInput,
  uuid,
  type Account,
  type Category,
  type Movement,
} from '@/lib/domain';

function escapeCell(value: string) {
  const protectedValue = /^\s*[=+@-]|^[\t\r\n']/.test(value)
    ? "'" + value
    : value;
  return '"' + protectedValue.replaceAll('"', '""') + '"';
}
function unprotect(value: string) {
  return /^'(?:\s*[=+@-]|[\t\r\n'])/.test(value) ? value.slice(1) : value;
}
export function encodeCsv(movements: Movement[]) {
  const lines = movements.map((m) =>
    [
      m.id,
      m.occurred_on,
      m.type === 'income' ? 'ingreso' : 'gasto',
      decimal(m.amount_cents),
      m.account_name,
      m.category_name,
      m.description,
    ]
      .map(escapeCell)
      .join(';'),
  );
  return '\uFEFF' + [csvColumns.join(';'), ...lines].join('\r\n') + '\r\n';
}
export function decodeCsv(
  text: string,
  accounts: Pick<Account, 'id' | 'name'>[],
  categories: Category[],
) {
  let records: string[][];
  try {
    records = parse(text, {
      bom: true,
      delimiter: ';',
      skip_empty_lines: true,
      max_record_size: 8192,
    });
  } catch {
    throw new Error(
      'CSV inválido. Revisá los separadores, las comillas y la cantidad de columnas.',
    );
  }
  const header = records.shift();
  if (
    !header ||
    header.length !== csvColumns.length ||
    !csvColumns.every((c, i) => header[i].trim().toLowerCase() === c)
  )
    throw new Error('Encabezado esperado: ' + csvColumns.join(';'));
  if (records.length < 1 || records.length > CSV_ROWS)
    throw new Error('Elegí un archivo de 1 a ' + CSV_ROWS + ' movimientos.');
  const accountMap = new Map(
    accounts.map((a) => [a.name.trim().toLowerCase(), a.id]),
  );
  const categoryMap = new Map(
    categories.map((c) => [c.type + ':' + c.name.trim().toLowerCase(), c.id]),
  );
  return records.map((row, i) => {
    const [id, date, kind, amount, account, category, description] =
      row.map(unprotect);
    const type = (
      { ingreso: 'income', gasto: 'expense' } as Record<string, string>
    )[kind.trim().toLowerCase()];
    const accountId = accountMap.get(account.trim().toLowerCase());
    const categoryId = categoryMap.get(
      type + ':' + category.trim().toLowerCase(),
    );
    const reason = !['income', 'expense'].includes(type)
      ? 'Usá ingreso o gasto.'
      : !accountId
        ? 'Cuenta desconocida.'
        : !categoryId
          ? 'Categoría desconocida para ese tipo.'
          : id && !uuid.safeParse(id).success
            ? 'El ID debe ser un UUID o quedar vacío.'
            : '';
    if (reason) throw new Error('Registro ' + (i + 1) + ': ' + reason);
    const input = transactionInput.safeParse({
      type,
      account_id: accountId,
      category_id: categoryId,
      occurred_on: date,
      amount_cents: amount,
      description,
    });
    if (!input.success)
      throw new Error(
        'Registro ' + (i + 1) + ': ' + input.error.issues[0].message,
      );
    return { reference: id || null, ...input.data };
  });
}
