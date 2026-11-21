import type { SummaryRow } from './domain';
export function summarize(rows: SummaryRow[]) {
  const totals = { income: 0n, expense: 0n };
  const weeks = Array.from({ length: 5 }, () => ({ income: 0n, expense: 0n }));
  const expenses = new Map<string, bigint>();
  const colors = new Map<string, string | null>();
  for (const row of rows) {
    const amount = BigInt(row.cents);
    totals[row.type] += amount;
    weeks[row.week - 1][row.type] += amount;
    if (row.type === 'expense') colors.set(row.category_name, row.color ?? null);
    if (row.type === 'expense')
      expenses.set(
        row.category_name,
        (expenses.get(row.category_name) ?? 0n) + amount,
      );
  }
  const categories = Array.from(expenses)
    .sort((a, b) =>
      a[1] === b[1] ? a[0].localeCompare(b[0], 'es') : a[1] > b[1] ? -1 : 1,
    )
    .map(([name, value]) => [name, value, colors.get(name) ?? null] as const);
  return { ...totals, net: totals.income - totals.expense, weeks, categories };
}
