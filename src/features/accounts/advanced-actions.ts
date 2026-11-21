'use server';
import { revalidatePath } from 'next/cache';
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

export async function saveTransfer(form: FormData): Promise<Feedback> {
  const { db, user } = await requireUser();
  const parsed = transfer.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const row = parsed.data;
  const owned = await db
    .from('accounts')
    .select('id')
    .eq('user_id', user.id)
    .in('id', [row.source_id, row.destination_id]);
  if (owned.error || owned.data?.length !== 2)
    return { error: 'Revisá las cuentas de origen y destino.' };
  const result = await db
    .from('transfers')
    .insert({ ...row, user_id: user.id });
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

export async function removeItem(
  table: 'transfers' | 'savings_goals',
  id: string,
): Promise<Feedback> {
  const { db, user } = await requireUser();
  if (
    !['transfers', 'savings_goals'].includes(table) ||
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
  return saved(
    table === 'transfers' ? 'Transferencia eliminada.' : 'Meta eliminada.',
  );
}
