create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source_id uuid not null,
  destination_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  occurred_on date not null check (occurred_on between date '1000-01-01' and date '9999-12-31'),
  description text not null default '' check (length(description) <= 500),
  check (source_id <> destination_id),
  foreign key (user_id, source_id) references public.accounts (user_id, id),
  foreign key (user_id, destination_id) references public.accounts (user_id, id)
);
create index transfers_history on public.transfers (user_id, occurred_on desc, id desc);
create index transfers_source on public.transfers (user_id, source_id);
create index transfers_destination on public.transfers (user_id, destination_id);

alter table public.transfers enable row level security;
revoke all on public.transfers from public, anon, authenticated;
grant select, insert, update, delete on public.transfers to authenticated;
create policy read_own on public.transfers for select to authenticated using ((select auth.uid()) = user_id);
create policy insert_own on public.transfers for insert to authenticated with check ((select auth.uid()) = user_id);
create policy update_own on public.transfers for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy delete_own on public.transfers for delete to authenticated using ((select auth.uid()) = user_id);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  account_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 80),
  target_cents bigint not null check (target_cents > 0),
  unique (user_id, account_id),
  foreign key (user_id, account_id) references public.accounts (user_id, id)
);

alter table public.savings_goals enable row level security;
revoke all on public.savings_goals from public, anon, authenticated;
grant select, insert, update, delete on public.savings_goals to authenticated;
create policy read_own on public.savings_goals for select to authenticated using ((select auth.uid()) = user_id);
create policy insert_own on public.savings_goals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy update_own on public.savings_goals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy delete_own on public.savings_goals for delete to authenticated using ((select auth.uid()) = user_id);

-- Cada transferencia contribuye una vez por lado. El historial de ingresos y gastos
-- sigue consultando exclusivamente transactions.
create or replace view public.account_balances with (security_invoker = true) as
select a.id, a.user_id, a.name, a.kind, a.opening_balance_cents::text,
  (a.opening_balance_cents + coalesce(sum(f.delta), 0))::text as balance_cents
from public.accounts a
left join (
  select user_id, account_id, case when type = 'income' then amount_cents::numeric else -amount_cents::numeric end as delta
  from public.transactions
  union all
  select user_id, source_id, -amount_cents::numeric from public.transfers
  union all
  select user_id, destination_id, amount_cents::numeric from public.transfers
) f on (a.user_id, a.id) = (f.user_id, f.account_id)
group by a.id;
