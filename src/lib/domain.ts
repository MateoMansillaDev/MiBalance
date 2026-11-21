import { z } from 'zod';
import { validDate } from './dates';
import { parseCents } from './money';

export const directions = { expense: 'Gasto', income: 'Ingreso' } as const;
export const kinds = {
  cash: 'Efectivo',
  bank: 'Banco',
  wallet: 'Billetera virtual',
  credit: 'Tarjeta de crédito',
} as const;
export const currencies = {
  ARS: 'Pesos (ARS)',
  USD: 'Dólares (USD)',
} as const;
export const categoryIcons = [
  'tag',
  'briefcase',
  'gift',
  'cart',
  'bus',
  'home',
  'utensils',
  'heart',
  'bolt',
  'film',
  'shirt',
  'book',
  'plane',
  'paw',
  'phone',
  'piggy',
] as const;
export const direction = z.enum(['expense', 'income']);
export const kind = z.enum(['cash', 'bank', 'wallet', 'credit']);
export const currency = z.enum(['ARS', 'USD']);
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' || v === undefined ? null : v), schema.nullable());
const name = z
  .string()
  .trim()
  .min(1, 'Ingresá un nombre.')
  .max(80, 'Usá hasta 80 caracteres.');
export const uuid = z.uuid({ error: 'Seleccioná una opción válida.' });
function amount(opening = false) {
  return z.string().transform((raw, ctx) => {
    try {
      return parseCents(raw, opening).toString();
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        message: error instanceof Error ? error.message : 'Importe inválido.',
      });
      return z.NEVER;
    }
  });
}
export const accountInput = z.object({
  name,
  kind,
  currency,
  opening_balance_cents: amount(true),
});
export const categoryInput = z.object({
  name,
  type: direction,
  color: optional(
    z
      .string()
      .transform((v) => v.toLowerCase())
      .pipe(z.string().regex(/^#[0-9a-f]{6}$/, 'Elegí un color válido.')),
  ),
  icon: optional(z.enum(categoryIcons, { error: 'Elegí un ícono de la lista.' })),
});
export const transactionInput = z.object({
  type: direction,
  account_id: uuid,
  category_id: uuid,
  amount_cents: amount(),
  occurred_on: z.string().refine(validDate, 'Ingresá una fecha válida.'),
  description: z.string().trim().max(500, 'Usá hasta 500 caracteres.'),
});
export type Direction = z.infer<typeof direction>;
export type Kind = z.infer<typeof kind>;
export type Currency = z.infer<typeof currency>;
export type CategoryIcon = (typeof categoryIcons)[number];
export type Account = {
  id: string;
  name: string;
  kind: Kind;
  opening_balance_cents: string;
  balance_cents: string;
  currency: Currency;
};
export type Category = {
  id: string;
  name: string;
  type: Direction;
  color: string | null;
  icon: CategoryIcon | null;
};
export type Movement = z.infer<typeof transactionInput> & {
  id: string;
  account_name: string;
  category_name: string;
  currency: Currency;
  installment_group: string | null;
  installment_number: number | null;
  installment_count: number | null;
  category_color: string | null;
  category_icon: CategoryIcon | null;
};
export type SummaryRow = {
  week: number;
  type: Direction;
  category_name: string;
  color?: string | null;
  icon?: string | null;
  cents: string;
};
