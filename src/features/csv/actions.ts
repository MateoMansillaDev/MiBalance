'use server';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { accounts, categories } from '@/features/ledger/queries';
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
export async function processCsv(
  form: FormData,
  confirmation?: { digest: string; skip: boolean[] },
): Promise<CsvResult> {
  const { db, user } = await requireUser();
  const file = form.get('file');
  if (!(file instanceof File) || !file.size || file.size > CSV_BYTES)
    return { error: 'Elegí un CSV UTF-8 de hasta 850 kB.' };
  const [list, tags] = await Promise.all([accounts(), categories()]);
  let entries: ReturnType<typeof decodeCsv>;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(
      await file.arrayBuffer(),
    );
    entries = decodeCsv(text, list, tags);
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
  const digest = (skip: boolean[]) =>
    createHash('sha256')
      .update(JSON.stringify([user.id, entries, skip]))
      .digest('hex');
  const flagsSchema = z.array(z.boolean()).length(entries.length);
  if (
    confirmation &&
    (!flagsSchema.safeParse(confirmation.skip).success ||
      confirmation.digest !== digest(confirmation.skip))
  )
    return {
      error:
        'El archivo o sus cuentas cambiaron. Volvé a revisar la vista previa.',
    };
  // Una fila omitida en la vista previa debe seguir omitida aunque cambie el historial.
  const items = confirmation
    ? entries.filter((_, i) => !confirmation.skip[i])
    : entries;
  if (!items.length) return { imported: 0, duplicates: entries.length };
  const { data, error } = await db.rpc('csv_batch', {
    items,
    apply_rows: Boolean(confirmation),
  });
  const result = z.array(z.boolean()).length(items.length).safeParse(data);
  if (error || !result.success)
    return {
      error:
        'No pudimos procesar el lote. Revisá la conexión y volvé a intentarlo.',
    };
  const flags = result.data;
  if (confirmation) {
    revalidatePath('/', 'layout');
    const imported = flags.filter((skip) => !skip).length;
    return { imported, duplicates: entries.length - imported };
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
