'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { today } from '@/lib/dates';
import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { transactionInput, uuid, accountInput } from '@/lib/domain';
import type { Feedback } from '@/components/MutationForm';

const transfer = transactionInput
  .pick({ amount_cents: true, occurred_on: true, description: true })
  .extend({ id: uuid, source_id: uuid, destination_id: uuid })
  .refine(
    (t) => t.source_id !== t.destination_id,
    'Elegí dos cuentas diferentes.',
  );
const goal = z.object({
  account_id: uuid,
  name: accountInput.shape.name,
  target_cents: transactionInput.shape.amount_cents,
});

function saved(message: string): Feedback {
  revalidatePath('/', 'layout');
  return { message };
}

export async function saveTransfer(
  editing: string | null,
  form: FormData,
): Promise<Feedback> {
  const { db, user } = await requireUser();
  const parsed = transfer.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const row = parsed.data;
  const owned = await db
    .from('accounts')
    .select('id,currency')
    .eq('user_id', user.id)
    .in('id', [row.source_id, row.destination_id]);
  if (owned.error || owned.data?.length !== 2)
    return { error: 'Revisá las cuentas de origen y destino.' };
  if (owned.data[0].currency !== owned.data[1].currency)
    return {
      error:
        'Las dos cuentas deben tener la misma moneda. Para pasar de pesos a dólares usá Compra y venta de dólares.',
    };
  const currency = owned.data[0].currency as string;
  if (editing) {
    if (!uuid.safeParse(editing).success) return { error: 'Registro inválido.' };
    const { id: _ignored, ...changes } = row;
    void _ignored;
    const { data, error } = await db
      .from('transfers')
      .update({ ...changes, currency })
      .eq('user_id', user.id)
      .eq('id', editing)
      .select('id')
      .maybeSingle();
    return error || !data
      ? { error: 'No se pudo guardar la transferencia.' }
      : saved('Transferencia actualizada.');
  }
  const result = await db
    .from('transfers')
    .insert({ ...row, currency, user_id: user.id });
  if (result.error?.code === '23505') {
    const prior = await db
      .from('transfers')
      .select(
        'source_id,destination_id,amount_cents::text,occurred_on,description',
      )
      .eq('user_id', user.id)
      .eq('id', row.id)
      .maybeSingle();
    if (
      prior.data &&
      Object.entries(prior.data).every(
        ([key, value]) => row[key as keyof typeof row] === value,
      )
    )
      return saved('Transferencia registrada.');
  }
  if (result.error)
    return {
      error:
        'No se pudo registrar la transferencia. Revisá el historial antes de reintentar.',
    };
  return saved('Transferencia registrada.');
}

export async function saveGoal(
  id: string | null,
  form: FormData,
): Promise<Feedback> {
  const { db, user } = await requireUser();
  const parsed = goal.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const owned = await db
    .from('accounts')
    .select('id')
    .eq('user_id', user.id)
    .eq('id', parsed.data.account_id)
    .maybeSingle();
  if (!owned.data) return { error: 'Elegí una cuenta propia disponible.' };
  if (id !== null && !uuid.safeParse(id).success)
    return { error: 'Meta inválida.' };
  const table = db.from('savings_goals');
  const operation = id
    ? table.update(parsed.data).eq('user_id', user.id).eq('id', id)
    : table.insert({ ...parsed.data, user_id: user.id });
  const { data, error } = await operation.select('id').maybeSingle();
  if (error?.code === '23505')
    return { error: 'Esta cuenta ya tiene una meta.' };
  return error || !data
    ? { error: 'No se pudo guardar la meta.' }
    : saved('Meta guardada.');
}

const removable = {
  transfers: 'Transferencia eliminada.',
  savings_goals: 'Meta eliminada.',
  exchanges: 'Operación eliminada.',
} as const;
export async function removeItem(
  table: keyof typeof removable,
  id: string,
): Promise<Feedback> {
  const { db, user } = await requireUser();
  if (
    !Object.hasOwn(removable, table) ||
    !uuid.safeParse(id).success
  )
    return { error: 'Registro inválido.' };
  const { data, error } = await db
    .from(table)
    .delete()
    .eq('user_id', user.id)
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error || !data) return { error: 'No se pudo eliminar el registro.' };
  return saved(removable[table]);
}

const rate = z.object({ ars_cents_per_usd: transactionInput.shape.amount_cents });
export async function saveRate(form: FormData): Promise<Feedback> {
  const { db, user } = await requireUser();
  const parsed = rate.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await db.from('exchange_rates').upsert({
    user_id: user.id,
    ars_cents_per_usd: parsed.data.ars_cents_per_usd,
    updated_on: today(),
  });
  return error
    ? { error: 'No se pudo guardar la cotización.' }
    : saved('Cotización guardada.');
}

const exchange = z
  .object({
    source_id: uuid,
    destination_id: uuid,
    source_cents: transactionInput.shape.amount_cents,
    destination_cents: transactionInput.shape.amount_cents,
    occurred_on: transactionInput.shape.occurred_on,
    description: transactionInput.shape.description,
  })
  .refine((e) => e.source_id !== e.destination_id, 'Elegí dos cuentas diferentes.');
export async function saveExchange(form: FormData): Promise<Feedback> {
  const { db, user } = await requireUser();
  const parsed = exchange.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const row = parsed.data;
  const owned = await db
    .from('accounts')
    .select('id,currency')
    .eq('user_id', user.id)
    .in('id', [row.source_id, row.destination_id]);
  if (owned.error || owned.data?.length !== 2)
    return { error: 'Revisá las cuentas de origen y destino.' };
  const currencyOf = new Map(owned.data.map((a) => [a.id, a.currency as string]));
  const source_currency = currencyOf.get(row.source_id);
  const destination_currency = currencyOf.get(row.destination_id);
  if (source_currency === destination_currency)
    return {
      error: 'Elegí una cuenta en pesos y otra en dólares. Para la misma moneda usá Transferencias.',
    };
  const { error } = await db.from('exchanges').insert({
    ...row,
    source_currency,
    destination_currency,
    user_id: user.id,
  });
  return error
    ? { error: 'No se pudo registrar la operación.' }
    : saved('Operación registrada.');
}

export async function removeInstallments(group: string): Promise<Feedback> {
  const { db, user } = await requireUser();
  if (!uuid.safeParse(group).success) return { error: 'Compra inválida.' };
  const { data, error } = await db
    .from('transactions')
    .delete()
    .eq('user_id', user.id)
    .eq('installment_group', group)
    .select('id');
  if (error || !data?.length) return { error: 'No se pudieron eliminar las cuotas.' };
  revalidatePath('/', 'layout');
  redirect('/movimientos');
}
