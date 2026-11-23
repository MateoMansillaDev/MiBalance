import type { Account, Category, Movement, SummaryRow } from '@/lib/domain';
import type { Book } from './book';
import type { Rec } from './schema';

// Consultas equivalentes a las vistas y funciones SQL anteriores. Los importes
// salen como texto, igual que de la API, y se suman con bigint.
const byName = (a: { name: string; id: string }, b: { name: string; id: string }) =>
  a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id);

export function accountBalances(book: Book): Account[] {
  const delta = new Map<string, bigint>();
  const add = (id: string, v: bigint) => delta.set(id, (delta.get(id) ?? 0n) + v);
  for (const t of book.live('transactions'))
    add(t.account_id, t.type === 'income' ? BigInt(t.amount_cents) : -BigInt(t.amount_cents));
  for (const t of book.live('transfers')) {
    add(t.source_id, -BigInt(t.amount_cents));
    add(t.destination_id, BigInt(t.amount_cents));
  }
  for (const e of book.live('exchanges')) {
    add(e.source_id, -BigInt(e.source_cents));
    add(e.destination_id, BigInt(e.destination_cents));
  }
  return book
    .live('accounts')
    .map((a) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      currency: a.currency,
      opening_balance_cents: a.opening_balance_cents,
      balance_cents: (BigInt(a.opening_balance_cents) + (delta.get(a.id) ?? 0n)).toString(),
    }))
    .sort(byName);
}

export function categoryList(book: Book): Category[] {
  return book
    .live('categories')
    .map(({ id, name, type, color, icon }) => ({ id, name, type, color, icon }))
    .sort(byName);
}

export function movementView(book: Book, t: Rec<'transactions'>): Movement | null {
  const a = book.get('accounts', t.account_id);
  const c = book.get('categories', t.category_id);
  if (!a || !c) return null;
  return {
    id: t.id,
    type: t.type,
    amount_cents: t.amount_cents,
    occurred_on: t.occurred_on,
    description: t.description,
    account_id: a.id,
    account_name: a.name,
    category_id: c.id,
    category_name: c.name,
    currency: a.currency,
    installment_group: t.installment_group,
    installment_number: t.installment_number,
    installment_count: t.installment_count,
    category_color: c.color,
    category_icon: c.icon,
  };
}

export type Criteria = Partial<Record<'desde' | 'hasta' | 'tipo' | 'cuenta' | 'categoria' | 'q', string>>;
/** Una sola definición de los filtros para la tabla, sus totales y el CSV. */
export function filteredHistory(book: Book, criteria: Criteria, ascending = false) {
  const q = criteria.q?.toLowerCase();
  return book
    .live('transactions')
    .filter(
      (t) =>
        (!criteria.desde || t.occurred_on >= criteria.desde) &&
        (!criteria.hasta || t.occurred_on <= criteria.hasta) &&
        (!criteria.tipo || t.type === criteria.tipo) &&
        (!criteria.cuenta || t.account_id === criteria.cuenta) &&
        (!criteria.categoria || t.category_id === criteria.categoria) &&
        (!q || t.description.toLowerCase().includes(q)),
    )
    .map((t) => movementView(book, t))
    .filter((m): m is Movement => m !== null)
    .sort((a, b) => {
      const order = a.occurred_on.localeCompare(b.occurred_on) || a.id.localeCompare(b.id);
      return ascending ? order : -order;
    });
}
export function filteredTotals(rows: Movement[]) {
  const totals = { income: 0n, expense: 0n };
  for (const r of rows) if (r.currency === 'ARS') totals[r.type] += BigInt(r.amount_cents);
  return totals;
}

function pesoRows(book: Book, start: string, end: string) {
  return book
    .live('transactions')
    .filter((t) => t.occurred_on >= start && t.occurred_on <= end)
    .filter((t) => book.get('accounts', t.account_id)?.currency === 'ARS');
}
/** Resumen semanal por categoría, solo en pesos (period_summary). */
export function periodSummary(book: Book, start: string, end: string): SummaryRow[] {
  const groups = new Map<string, SummaryRow>();
  for (const t of pesoRows(book, start, end)) {
    const c = book.get('categories', t.category_id);
    if (!c) continue;
    const week = Math.floor((Number(t.occurred_on.slice(8)) - 1) / 7) + 1;
    const k = week + '|' + t.type + '|' + c.name;
    const prior = groups.get(k);
    groups.set(k, {
      week,
      type: t.type,
      category_name: c.name,
      color: c.color,
      icon: c.icon,
      cents: (BigInt(prior?.cents ?? 0) + BigInt(t.amount_cents)).toString(),
    });
  }
  return [...groups.values()];
}
export function monthlyTotals(book: Book, start: string, end: string) {
  const months = new Map<string, { month: string; income: bigint; expense: bigint }>();
  for (const t of pesoRows(book, start, end)) {
    const month = t.occurred_on.slice(0, 7);
    const m = months.get(month) ?? { month, income: 0n, expense: 0n };
    m[t.type] += BigInt(t.amount_cents);
    months.set(month, m);
  }
  return [...months.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ month: m.month, income: m.income.toString(), expense: m.expense.toString() }));
}
export function budgetProgress(book: Book, month: string) {
  const start = month + '-01';
  const end = month + '-31';
  return book
    .live('budgets')
    .filter((b) => b.month_start === start)
    .map((b) => {
      const c = book.get('categories', b.category_id);
      if (!c) return null;
      const spent = pesoRows(book, start, end)
        .filter((t) => t.category_id === b.category_id && t.type === 'expense')
        .reduce((s, t) => s + BigInt(t.amount_cents), 0n);
      return {
        id: b.id,
        name: c.name,
        category_id: b.category_id,
        limit_cents: b.limit_cents,
        spent_cents: spent.toString(),
      };
    })
    .filter((b) => b !== null)
    .sort(byName);
}
export function ruleSchedule(book: Book) {
  return book
    .live('rules')
    .map((r) => {
      const a = book.get('accounts', r.account_id);
      const c = book.get('categories', r.category_id);
      if (!a || !c) return null;
      return {
        id: r.id,
        frequency: r.frequency,
        next_due: r.next_due,
        starts_on: r.starts_on,
        type: r.type,
        description: r.description,
        amount_cents: r.amount_cents,
        account_name: a.name,
        category_name: c.name,
        currency: a.currency,
      };
    })
    .filter((r) => r !== null)
    .sort((a, b) => a.next_due.localeCompare(b.next_due) || a.id.localeCompare(b.id));
}
