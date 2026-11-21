import { requireUser } from '@/lib/supabase/server';
import { allRows } from '@/features/ledger/queries';
import type { Account, Category, Direction } from '@/lib/domain';
import type { RecurringRule } from '@/lib/insights';

type Raw = {
  type: Direction;
  amount_cents: string;
  frequency: 'weekly' | 'monthly';
  starts_on: string;
  next_due: string;
  description: string;
  account_id: string;
  category_id: string;
};
export async function recurringRules(
  accounts: Account[],
  categories: Category[],
): Promise<RecurringRule[]> {
  const { db, user } = await requireUser();
  const rows = await allRows<Raw>((offset) =>
    db
      .from('recurring_rules')
      .select(
        'type,amount_cents::text,frequency,starts_on,next_due,description,account_id,category_id',
      )
      .eq('user_id', user.id)
      .order('next_due')
      .order('id')
      .range(offset, offset + 199)
      .returns<Raw[]>(),
  );
  const currencyOf = new Map(accounts.map((a) => [a.id, a.currency]));
  const nameOf = new Map(categories.map((c) => [c.id, c.name]));
  return rows.map((r) => ({
    type: r.type,
    amount_cents: r.amount_cents,
    frequency: r.frequency,
    starts_on: r.starts_on,
    next_due: r.next_due,
    description: r.description,
    currency: currencyOf.get(r.account_id) ?? 'ARS',
    category_name: nameOf.get(r.category_id) ?? '',
  }));
}
