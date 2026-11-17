import { validDate } from '@/lib/dates';
import { direction, uuid } from '@/lib/domain';
export type Params = Record<string, string | string[] | undefined>;
export function historyFilters(params: Params) {
  const read = (key: string) =>
    typeof params[key] === 'string' ? params[key] : '';
  const start = read('desde'),
    end = read('hasta'),
    type = read('tipo');
  const account = read('cuenta'),
    category = read('categoria'),
    q = read('q').trim();
  const page = Number(read('pagina') || 1);
  const invalid =
    (start && !validDate(start)) ||
    (end && !validDate(end)) ||
    (start && end && start > end) ||
    (type && !direction.safeParse(type).success) ||
    (account && !uuid.safeParse(account).success) ||
    (category && !uuid.safeParse(category).success) ||
    q.length > 100 ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 10000000;
  return {
    start,
    end,
    type,
    account,
    category,
    q,
    page,
    ascending: read('orden') === 'asc',
    invalid: !!invalid,
  };
}
export type Filters = ReturnType<typeof historyFilters>;
