'use client';
import { mutate, currentBook } from '@/local/store';
import { accountBalances, categoryList } from '@/local/views';
import { CSV_BYTES } from './limits';
import { decodeCsv } from './format';
import { money } from '@/lib/money';
import { directions } from '@/lib/domain';

export type CsvResult =
  | { error: string }
  | { imported: number; duplicates: number }
  | {
      digest: string;
      preview: {
        date: string;
        label: string;
        account: string;
        category: string;
        amount: string;
        note: string;
        skip: boolean;
      }[];
    };
/** Vista previa y confirmación de un CSV, con los mismos controles que la versión anterior. */
export async function processCsv(
  file: File,
  confirmation?: { digest: string; skip: boolean[] },
): Promise<CsvResult> {
  if (!file.size || file.size > CSV_BYTES) return { error: 'Elegí un CSV UTF-8 de hasta 850 kB.' };
  const book = currentBook();
  const list = accountBalances(book);
  const tags = categoryList(book);
  let entries: ReturnType<typeof decodeCsv>;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    // Solo cuentas en pesos: una cuenta en dólares no figura y su fila se rechaza.
    entries = decodeCsv(
      text,
      list.filter((a) => a.currency === 'ARS'),
      tags,
    );
  } catch (error) {
    return {
      error:
        error instanceof TypeError
          ? 'Guardá el archivo como UTF-8.'
          : error instanceof Error
            ? error.message
            : 'No pudimos leer el CSV.',
    };
  }
  const digest = (skip: boolean[]) => JSON.stringify([entries, skip]);
  if (
    confirmation &&
    (confirmation.skip.length !== entries.length || confirmation.digest !== digest(confirmation.skip))
  )
    return { error: 'El archivo o sus cuentas cambiaron. Volvé a revisar la vista previa.' };
  // Una fila omitida en la vista previa debe seguir omitida aunque cambie el historial.
  const items = confirmation ? entries.filter((_, i) => !confirmation.skip[i]) : entries;
  if (!items.length) return { imported: 0, duplicates: entries.length };
  const rows = items.map((e) => ({ ...e, reference: e.reference ?? null }));
  if (confirmation) {
    let flags: boolean[] = [];
    const result = mutate((b) => {
      flags = b.csvBatch(rows, true);
    });
    if ('error' in result) return result;
    const imported = flags.filter((skip) => !skip).length;
    return { imported, duplicates: entries.length - imported };
  }
  let flags: boolean[];
  try {
    flags = currentBook().csvBatch(rows, false);
  } catch (error) {
    return { error: (error as Error).message };
  }
  const accountNames = new Map(list.map((item) => [item.id, item.name]));
  const categoryNames = new Map(tags.map((item) => [item.id, item.name]));
  return {
    digest: digest(flags),
    preview: entries.map((e, i) => ({
      date: e.occurred_on,
      label: directions[e.type],
      account: accountNames.get(e.account_id)!,
      category: categoryNames.get(e.category_id)!,
      amount: money(e.amount_cents),
      note: e.description,
      skip: flags[i],
    })),
  };
}
