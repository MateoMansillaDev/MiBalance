import { requireUser } from '@/lib/supabase/server';
import { allRows } from '@/features/ledger/queries';
import type { Direction } from '@/lib/domain';
export type Budget = {
  id: string;
  name: string;
  category_id: string;
  limit_cents: string;
  spent_cents: string;
};
export type Rule = {
  id: string;
  frequency: 'monthly' | 'weekly';
  next_due: string;
  type: Direction;
  description: string;
  amount_cents: string;
  account_name: string;
  category_name: string;
};
export async function budgets(month: string) {
  const { db, user } = await requireUser();
  return allRows<Budget>((offset) =>
    db
      .from('monthly_budget_progress')
      .select('id,name,category_id,limit_cents,spent_cents')
      .eq('user_id', user.id)
      .eq('month_start', month + '-01')
      .order('name')
      .order('id')
      .range(offset, offset + 199)
      .returns<Budget[]>(),
  );
}
export async function rules() {
  const { db, user } = await requireUser();
  return allRows<Rule>((offset) =>
    db
      .from('recurring_schedule')
      .select(
        'id,frequency,next_due,type,description,amount_cents,account_name,category_name',
      )
      .eq('user_id', user.id)
      .order('next_due')
      .order('id')
      .range(offset, offset + 199)
      .returns<Rule[]>(),
  );
}
export function budgetStatus(spent: bigint, limit: bigint) {
  if (spent > limit) return 'Límite superado';
  if (spent === limit) return 'Límite alcanzado';
  return spent * 5n >= limit * 4n
    ? 'Alcanzaste el 80 %'
    : 'Dentro del presupuesto';
}
