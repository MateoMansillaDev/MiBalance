import { z } from 'zod';
import { requireUser } from '@/lib/supabase/server';
import { allRows } from './queries';
import { filterCriteria, type Filters } from './filters';
type SavedFilter = { id: string; name: string; query: string };
export async function savedFilters() {
  const { db, user } = await requireUser();
  return allRows<SavedFilter>((offset) =>
    db
      .from('saved_filters')
      .select('id,name,query')
      .eq('user_id', user.id)
      .order('name')
      .order('id')
      .range(offset, offset + 199)
      .returns<SavedFilter[]>(),
  );
}
export async function reportTotals(filters: Filters) {
  const { db } = await requireUser();
  const { data, error } = await db.rpc('filtered_totals', {
    criteria: filterCriteria(filters),
  });
  if (error) throw new Error('No se pudo cargar el reporte.');
  return z
    .object({
      income: z.string().regex(/^\d+$/),
      expense: z.string().regex(/^\d+$/),
    })
    .parse(data);
}
