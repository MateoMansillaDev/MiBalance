import { z } from 'zod';
import { validDate } from './dates';
import { parseCents } from './money';

export const directions = { expense: 'Gasto', income: 'Ingreso' } as const;
export const kinds = {
  cash: 'Efectivo',
  bank: 'Banco',
  wallet: 'Billetera virtual',
} as const;
export const direction = z.enum(['expense', 'income']);
export const kind = z.enum(['cash', 'bank', 'wallet']);
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
  opening_balance_cents: amount(true),
});
export const categoryInput = z.object({ name, type: direction });
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
export type Account = {
  id: string;
  name: string;
  kind: Kind;
  opening_balance_cents: string;
  balance_cents: string;
};
export type Category = { id: string; name: string; type: Direction };
export type Movement = z.infer<typeof transactionInput> & {
  id: string;
  account_name: string;
  category_name: string;
};
export type SummaryRow = {
  week: number;
  type: Direction;
  category_name: string;
  cents: string;
};
