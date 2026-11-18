import { requireUser } from '@/lib/supabase/server';
import { historyFilters } from '@/features/ledger/filters';
import { history } from '@/features/ledger/queries';
import { encodeCsv } from '@/features/csv/format';
import { CSV_ROWS } from '@/features/csv/limits';
export async function GET(request: Request) {
  await requireUser();
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const filters = historyFilters({ ...params, pagina: params.lote || '1' });
  if (filters.invalid)
    return new Response('Revisá los filtros o el número de lote.', {
      status: 400,
    });
  const { rows } = await history(filters, CSV_ROWS);
  return new Response(encodeCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition':
        'attachment; filename="mibalance-' + filters.page + '.csv"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
