import { requireUser } from '@/lib/supabase/server';
import {
  direction,
  type Account,
  type Category,
  type Movement,
} from '@/lib/domain';
import { z } from 'zod';
import type { Filters } from './filters';

async function allRows<T>(
  fetchPage: (
    offset: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const result: T[] = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await fetchPage(offset);
    if (error || !data) throw new Error('No se pudo consultar el catálogo.');
    result.push(...data);
    if (data.length < 200) return result;
  }
}
export async function accounts() {
  const { db, user } = await requireUser();
  return allRows<Account>((offset) =>
    db
      .from('account_balances')
      .select('id,name,kind,opening_balance_cents,balance_cents')
      .eq('user_id', user.id)
      .order('name')
      .order('id')
      .range(offset, offset + 199)
      .returns<Account[]>(),
  );
}
export async function categories() {
  const { db, user } = await requireUser();
  return allRows<Category>((offset) =>
    db
      .from('categories')
      .select('id,name,type')
      .eq('user_id', user.id)
      .order('name')
      .order('id')
      .range(offset, offset + 199)
      .returns<Category[]>(),
  );
}
const fields =
  'id,account_id,category_id,account_name,category_name,type,amount_cents,occurred_on,description';
export async function movement(id: string) {
  const { db, user } = await requireUser();
  const result = await db
    .from('movement_history')
    .select(fields)
    .eq('user_id', user.id)
    .eq('id', id)
    .maybeSingle<Movement>();
  if (result.error) throw new Error('No se pudo consultar el movimiento.');
  return result.data;
}
export async function history(filters: Filters, size = 20) {
  const { db, user } = await requireUser();
  let query = db
    .from('movement_history')
    .select(fields, { count: 'exact' })
    .eq('user_id', user.id);
  if (filters.start) query = query.gte('occurred_on', filters.start);
  if (filters.end) query = query.lte('occurred_on', filters.end);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.account) query = query.eq('account_id', filters.account);
  if (filters.category) query = query.eq('category_id', filters.category);
  if (filters.q)
    query = query.ilike(
      'description',
      '%' + filters.q.replace(/[\\%_]/g, '\\$&') + '%',
    );
  const offset = (filters.page - 1) * size;
  const { data, count, error } = await query
    .order('occurred_on', { ascending: filters.ascending })
    .order('id', { ascending: filters.ascending })
    .range(offset, offset + size - 1)
    .returns<Movement[]>();
  if (error) throw new Error('No se pudo consultar el historial.');
  return { rows: data ?? [], count: count ?? 0 };
}
export async function summary(start: string, end: string) {
  const { db } = await requireUser();
  const { data, error } = await db.rpc('period_summary', {
    start_date: start,
    end_date: end,
  });
  if (error || !data) throw new Error('No se pudo consultar el resumen.');
  return z
    .array(
      z.object({
        week: z.int().min(1).max(5),
        type: direction,
        category_name: z.string(),
        cents: z.string().regex(/^\d+$/),
      }),
    )
    .parse(data);
}
