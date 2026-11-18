'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/supabase/server';
import { validDate } from '@/lib/dates';
import { parseCents } from '@/lib/money';
import { transactionInput, uuid } from '@/lib/domain';
import type { Feedback } from '@/components/MutationForm';
import { filterQuery, historyFilters } from '@/features/ledger/filters';

export async function saveBudget(form: FormData): Promise<Feedback> {
  const { db, user } = await requireUser();
  const category = String(form.get('category_id'));
  const month = String(form.get('month')) + '-01';
  if (!uuid.safeParse(category).success || !validDate(month))
    return { error: 'Elegí el mes y una categoría de gasto.' };
  let cents: bigint;
  try {
    cents = parseCents(String(form.get('amount')));
  } catch {
    return {
      error: 'Ingresá un límite positivo en pesos, con hasta dos decimales.',
    };
  }
  const own = await db
    .from('categories')
    .select('id')
    .eq('id', category)
    .eq('user_id', user.id)
    .eq('type', 'expense')
    .maybeSingle();
  if (own.error || !own.data)
    return { error: 'La categoría de gasto ya no está disponible.' };
  const { error } = await db
    .from('budgets')
    .upsert(
      {
        user_id: user.id,
        month_start: month,
        category_id: category,
        limit_cents: cents.toString(),
      },
      { onConflict: 'user_id,month_start,category_id' },
    );
  if (error) return { error: 'No pudimos guardar el presupuesto.' };
  revalidatePath('/planificacion');
  revalidatePath('/resumen');
  return { message: 'Presupuesto guardado.' };
}

export async function addRule(form: FormData): Promise<Feedback> {
  const { db, user } = await requireUser();
  const parsed = transactionInput.safeParse(Object.fromEntries(form));
  const frequency = form.get('frequency');
  const id = uuid.safeParse(form.get('id'));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!id.success || !['monthly', 'weekly'].includes(String(frequency)))
    return { error: 'Revisá la frecuencia.' };
  const { occurred_on: start, ...tx } = parsed.data;
  if (start < '1900-01-01')
    return { error: 'La primera fecha debe ser posterior a 1899.' };
  const [a, c] = await Promise.all([
    db
      .from('accounts')
      .select('id')
      .eq('id', tx.account_id)
      .eq('user_id', user.id)
      .maybeSingle(),
    db
      .from('categories')
      .select('id')
      .eq('id', tx.category_id)
      .eq('user_id', user.id)
      .eq('type', tx.type)
      .maybeSingle(),
  ]);
  if (!a.data || !c.data)
    return {
      error: 'Elegí una cuenta propia y una categoría del tipo elegido.',
    };
  const { error } = await db
    .from('recurring_rules')
    .upsert(
      {
        id: id.data,
        user_id: user.id,
        ...tx,
        frequency,
        starts_on: start,
        next_due: start,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );
  if (error) return { error: 'No pudimos programar el movimiento.' };
  revalidatePath('/', 'layout');
  return { message: 'Movimiento recurrente programado.' };
}

export async function saveFilter(
  query: string,
  form: FormData,
): Promise<Feedback> {
  const { db, user } = await requireUser();
  const name = String(form.get('name') ?? '').trim();
  const filters = historyFilters(
    Object.fromEntries(new URLSearchParams(query)),
  );
  if (!name || name.length > 80 || filters.invalid)
    return { error: 'Revisá el nombre y los filtros.' };
  const { error } = await db
    .from('saved_filters')
    .upsert(
      { user_id: user.id, name, query: filterQuery(filters) },
      { onConflict: 'user_id,name' },
    );
  if (error) return { error: 'No pudimos guardar el filtro.' };
  revalidatePath('/movimientos');
  return { message: 'Filtro guardado.' };
}

export async function removePlanItem(
  table: 'budgets' | 'recurring_rules' | 'saved_filters',
  id: string,
): Promise<Feedback> {
  const { db, user } = await requireUser();
  if (
    !['budgets', 'recurring_rules', 'saved_filters'].includes(table) ||
    !uuid.safeParse(id).success
  )
    return { error: 'Registro inválido.' };
  const { data, error } = await db
    .from(table)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();
  if (error || !data) return { error: 'El registro ya no está disponible.' };
  revalidatePath(table === 'saved_filters' ? '/movimientos' : '/planificacion');
  if (table === 'budgets') revalidatePath('/resumen');
  return { message: 'Registro eliminado.' };
}
