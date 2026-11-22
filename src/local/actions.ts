'use client';
import { z } from 'zod';
import {
  accountInput,
  categoryInput,
  transactionInput,
  uuid,
} from '@/lib/domain';
import { parseCents } from '@/lib/money';
import { today, validDate } from '@/lib/dates';
import { filterQuery, historyFilters } from '@/features/ledger/filters';
import { mutate } from './store';

// Acciones de las pantallas: validan el formulario con los mismos esquemas
// Zod y aplican la operación sobre el libro local.
export type Feedback = { error: string } | { message: string; go?: string };
const first = (e: z.ZodError) => e.issues[0].message;
function done(result: ReturnType<typeof mutate>, message: string, go?: string): Feedback {
  return 'error' in result ? result : { message, go };
}

export type Resource = 'accounts' | 'categories' | 'transactions';
const paths = { accounts: '/cuentas', categories: '/categorias', transactions: '/movimientos' };

export function saveRecord(resource: Resource, id: string | null, form: FormData): Feedback {
  const input = Object.fromEntries(form);
  if (resource === 'accounts') {
    const parsed = accountInput.safeParse(input);
    if (!parsed.success) return { error: first(parsed.error) };
    return done(mutate((b) => b.saveAccount(id, parsed.data)), 'Cuenta guardada.', paths.accounts);
  }
  if (resource === 'categories') {
    const parsed = categoryInput.safeParse(input);
    if (!parsed.success) return { error: first(parsed.error) };
    return done(mutate((b) => b.saveCategory(id, parsed.data)), 'Categoría guardada.', paths.categories);
  }
  const parsed = transactionInput.safeParse(input);
  if (!parsed.success) return { error: first(parsed.error) };
  const count = Number(form.get('cuotas') || 1);
  if (!Number.isInteger(count) || count < 1 || count > 60)
    return { error: 'Elegí entre 2 y 60 cuotas.' };
  if (!id && count > 1) {
    const group = uuid.safeParse(form.get('installment_group'));
    if (!group.success) return { error: 'Volvé a cargar el formulario.' };
    return done(
      mutate((b) => b.addInstallments(parsed.data, count, group.data)),
      'Compra registrada.',
      paths.transactions,
    );
  }
  return done(mutate((b) => b.saveMovement(id, parsed.data)), 'Movimiento guardado.', paths.transactions);
}

export function removeRecord(resource: Resource, id: string): Feedback {
  const result = mutate((b) =>
    resource === 'accounts'
      ? b.removeAccount(id)
      : resource === 'categories'
        ? b.removeCategory(id)
        : b.removeMovement(id),
  );
  return done(result, 'Registro eliminado.', paths[resource]);
}

const transferForm = transactionInput
  .pick({ amount_cents: true, occurred_on: true, description: true })
  .extend({ id: uuid, source_id: uuid, destination_id: uuid });
export function saveTransfer(editing: string | null, form: FormData): Feedback {
  const parsed = transferForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: first(parsed.error) };
  const { id, ...input } = parsed.data;
  return done(
    mutate((b) => b.saveTransfer(editing ?? id, input, editing !== null)),
    editing ? 'Transferencia actualizada.' : 'Transferencia registrada.',
    editing ? '/cuentas/transferencias' : undefined,
  );
}

const goalForm = z.object({
  account_id: uuid,
  name: accountInput.shape.name,
  target_cents: transactionInput.shape.amount_cents,
});
export function saveGoal(id: string | null, form: FormData): Feedback {
  const parsed = goalForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: first(parsed.error) };
  const g = parsed.data;
  return done(mutate((b) => b.saveGoal(id, g.account_id, g.name, g.target_cents)), 'Meta guardada.');
}

const removers = {
  transfers: ['removeTransfer', 'Transferencia eliminada.'],
  savings_goals: ['removeGoal', 'Meta eliminada.'],
  exchanges: ['removeExchange', 'Operación eliminada.'],
  budgets: ['removeBudget', 'Registro eliminado.'],
  recurring_rules: ['removeRule', 'Registro eliminado.'],
  saved_filters: ['removeFilter', 'Registro eliminado.'],
} as const;
export function removeItem(table: keyof typeof removers, id: string): Feedback {
  const [method, message] = removers[table];
  return done(mutate((b) => b[method](id)), message);
}
export const removePlanItem = removeItem;

export function saveRate(form: FormData): Feedback {
  const parsed = transactionInput.shape.amount_cents.safeParse(form.get('ars_cents_per_usd'));
  if (!parsed.success) return { error: first(parsed.error) };
  return done(mutate((b) => b.setRate(parsed.data, today())), 'Cotización guardada.');
}

const exchangeForm = z.object({
  source_id: uuid,
  destination_id: uuid,
  source_cents: transactionInput.shape.amount_cents,
  destination_cents: transactionInput.shape.amount_cents,
  occurred_on: transactionInput.shape.occurred_on,
  description: transactionInput.shape.description,
});
export function saveExchange(form: FormData): Feedback {
  const parsed = exchangeForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: first(parsed.error) };
  return done(mutate((b) => b.saveExchange(parsed.data)), 'Operación registrada.');
}

export function removeInstallments(group: string): Feedback {
  return done(mutate((b) => b.removeInstallments(group)), 'Compra eliminada.', '/movimientos');
}

export function saveBudget(form: FormData): Feedback {
  const category = String(form.get('category_id'));
  const month = String(form.get('month'));
  if (!uuid.safeParse(category).success || !validDate(month + '-01'))
    return { error: 'Elegí el mes y una categoría de gasto.' };
  let cents: bigint;
  try {
    cents = parseCents(String(form.get('amount')));
  } catch {
    return { error: 'Ingresá un límite positivo en pesos, con hasta dos decimales.' };
  }
  return done(mutate((b) => b.saveBudget(month, category, cents.toString())), 'Presupuesto guardado.');
}

export function addRule(form: FormData): Feedback {
  const parsed = transactionInput.safeParse(Object.fromEntries(form));
  const frequency = String(form.get('frequency'));
  const id = uuid.safeParse(form.get('id'));
  if (!parsed.success) return { error: first(parsed.error) };
  if (!id.success || (frequency !== 'monthly' && frequency !== 'weekly'))
    return { error: 'Revisá la frecuencia.' };
  return done(
    mutate((b) => {
      b.saveRule({ ...parsed.data, frequency }, id.data);
      b.refresh(today());
    }),
    'Movimiento recurrente programado.',
  );
}

export function saveFilter(query: string, form: FormData): Feedback {
  const name = String(form.get('name') ?? '').trim();
  const filters = historyFilters(Object.fromEntries(new URLSearchParams(query)));
  if (!name || name.length > 80 || filters.invalid)
    return { error: 'Revisá el nombre y los filtros.' };
  return done(mutate((b) => b.saveFilter(name, filterQuery(filters))), 'Filtro guardado.');
}
