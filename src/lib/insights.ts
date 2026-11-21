import { addDays, addMonths } from './dates';
import type { Currency, Direction } from './domain';

export type RecurringRule = {
  type: Direction;
  amount_cents: string;
  frequency: 'weekly' | 'monthly';
  starts_on: string;
  next_due: string;
  currency: Currency;
  description: string;
  category_name: string;
};
export type Occurrence = {
  date: string;
  type: Direction;
  amount_cents: bigint;
  currency: Currency;
  label: string;
};

/** Mismas reglas que refresh_space(): semanal suma 7 días; mensual conserva el día de inicio. */
export function occurrences(rule: RecurringRule, until: string, limit = 400) {
  const result: Occurrence[] = [];
  const day = Number(rule.starts_on.slice(8));
  let due = rule.next_due;
  while (due <= until && result.length < limit) {
    result.push({
      date: due,
      type: rule.type,
      amount_cents: BigInt(rule.amount_cents),
      currency: rule.currency,
      label: rule.description || rule.category_name,
    });
    due = rule.frequency === 'weekly' ? addDays(due, 7) : addMonths(due, 1, day);
  }
  return result;
}

/** Lo que falta registrar en pesos hasta el cierre, según las repeticiones vigentes. */
export function pendingRecurring(rules: RecurringRule[], monthEnd: string) {
  const totals = { income: 0n, expense: 0n };
  for (const rule of rules) {
    if (rule.currency !== 'ARS') continue;
    for (const o of occurrences(rule, monthEnd)) totals[o.type] += o.amount_cents;
  }
  return totals;
}

export type CategoryChange = {
  name: string;
  current: bigint;
  previous: bigint;
  diff: bigint;
  percent: number | null;
};
/** Las categorías de gasto cuyo importe más cambió respecto del mes de referencia. */
export function categoryChanges(
  current: [string, bigint][],
  previous: [string, bigint][],
  limit = 3,
) {
  const names = new Set([...current, ...previous].map(([n]) => n));
  const now = new Map(current);
  const before = new Map(previous);
  const changes: CategoryChange[] = [];
  for (const name of names) {
    const c = now.get(name) ?? 0n;
    const p = before.get(name) ?? 0n;
    if (c === p) continue;
    changes.push({
      name,
      current: c,
      previous: p,
      diff: c - p,
      percent: p > 0n ? Number(((c - p) * 1000n) / p) / 10 : null,
    });
  }
  const size = (v: bigint) => (v < 0n ? -v : v);
  return changes
    .sort((a, b) =>
      size(a.diff) === size(b.diff)
        ? a.name.localeCompare(b.name, 'es')
        : size(a.diff) > size(b.diff)
          ? -1
          : 1,
    )
    .slice(0, limit);
}
