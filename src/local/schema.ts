import { z } from 'zod';
import { categoryIcons } from '@/lib/domain';

// Documento local de MiBalance. Cada registro lleva su sello de modificación
// para combinar copias de distintos dispositivos (gana la última escritura) y
// los borrados quedan como lápidas para que se propaguen al sincronizar.
const id = z.string().min(1).max(80);
const cents = z.string().regex(/^-?\d{1,19}$/);
const positive = z.string().regex(/^\d{1,19}$/).refine((v) => BigInt(v) > 0n);
const date = z.string().regex(/^\d{4}-\d\d-\d\d$/);
const meta = {
  id,
  updated_at: z.number().int().nonnegative(),
  device: z.string().min(1).max(80),
  deleted: z.boolean().optional(),
};
const flow = z.enum(['income', 'expense']);
export const records = {
  accounts: z.object({
    ...meta,
    name: z.string().max(80),
    kind: z.enum(['cash', 'bank', 'wallet', 'credit']),
    currency: z.enum(['ARS', 'USD']),
    opening_balance_cents: cents,
  }),
  categories: z.object({
    ...meta,
    name: z.string().max(80),
    type: flow,
    color: z.string().regex(/^#[0-9a-f]{6}$/).nullable(),
    icon: z.enum(categoryIcons).nullable(),
  }),
  transactions: z.object({
    ...meta,
    account_id: id,
    category_id: id,
    type: flow,
    amount_cents: positive,
    occurred_on: date,
    description: z.string().max(500),
    csv_key: z.string().max(70).nullable(),
    installment_group: id.nullable(),
    installment_number: z.number().int().nullable(),
    installment_count: z.number().int().nullable(),
  }),
  transfers: z.object({
    ...meta,
    source_id: id,
    destination_id: id,
    amount_cents: positive,
    occurred_on: date,
    description: z.string().max(500),
  }),
  exchanges: z.object({
    ...meta,
    source_id: id,
    destination_id: id,
    source_cents: positive,
    destination_cents: positive,
    occurred_on: date,
    description: z.string().max(500),
  }),
  budgets: z.object({
    ...meta,
    month_start: date,
    category_id: id,
    limit_cents: positive,
  }),
  rules: z.object({
    ...meta,
    account_id: id,
    category_id: id,
    type: flow,
    amount_cents: positive,
    description: z.string().max(500),
    frequency: z.enum(['weekly', 'monthly']),
    starts_on: date,
    next_due: date,
  }),
  goals: z.object({
    ...meta,
    account_id: id,
    name: z.string().max(80),
    target_cents: positive,
  }),
  filters: z.object({
    ...meta,
    name: z.string().max(80),
    query: z.string().max(1800),
  }),
  settings: z.object({ ...meta, value: z.string().max(2000) }),
};
export type Collection = keyof typeof records;
export const collections = Object.keys(records) as Collection[];
export type Rec<C extends Collection> = z.infer<(typeof records)[C]>;
export type Collections = { [C in Collection]: Record<string, Rec<C>> };
export type Doc = { format: 'mibalance'; version: 1; collections: Collections };

export function emptyDoc(): Doc {
  return {
    format: 'mibalance',
    version: 1,
    collections: Object.fromEntries(
      collections.map((c) => [c, {}]),
    ) as unknown as Collections,
  };
}

/** Valida un documento leído del dispositivo o de Drive. Rechaza datos ajenos al formato. */
export function parseDoc(text: string): Doc {
  const raw = JSON.parse(text) as {
    format?: unknown;
    version?: unknown;
    collections?: Record<string, Record<string, unknown>>;
  };
  if (raw?.format !== 'mibalance' || raw.version !== 1 || typeof raw.collections !== 'object')
    throw new Error('El archivo no tiene el formato de MiBalance.');
  const doc = emptyDoc();
  for (const c of collections) {
    const entries = Object.entries(raw.collections[c] ?? {});
    for (const [key, value] of entries) {
      const rec = records[c].parse(value);
      if (rec.id !== key) throw new Error('El archivo de MiBalance está dañado.');
      (doc.collections[c] as Record<string, unknown>)[key] = rec;
    }
  }
  return doc;
}
