create type public.flow as enum ('income', 'expense');
create type public.account_kind as enum ('cash', 'bank', 'wallet');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null check (length(trim(name)) between 1 and 80),
  kind public.account_kind not null,
  opening_balance_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);
create unique index accounts_name on public.accounts (user_id, lower(trim(name)));

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null check (length(trim(name)) between 1 and 80),
  type public.flow not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id, type)
);
create unique index categories_name on public.categories (user_id, type, lower(trim(name)));

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  account_id uuid not null,
  category_id uuid not null,
  type public.flow not null,
  amount_cents bigint not null check (amount_cents > 0),
  occurred_on date not null check (occurred_on between date '1000-01-01' and date '9999-12-31'),
  description text not null default '' check (length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, account_id) references public.accounts (user_id, id),
  foreign key (user_id, category_id, type) references public.categories (user_id, id, type)
);
create index transactions_date on public.transactions (user_id, occurred_on desc, id desc);
create index transactions_account on public.transactions (user_id, account_id, occurred_on);
create index transactions_category on public.transactions (user_id, category_id, type, occurred_on);
create index transactions_flow on public.transactions (user_id, type, occurred_on);

create function public.touch_updated_at() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

alter table public.accounts enable row level security;
revoke all on public.accounts from public, anon, authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
create policy read_own on public.accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy insert_own on public.accounts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy update_own on public.accounts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy delete_own on public.accounts for delete to authenticated using ((select auth.uid()) = user_id);
create trigger touch before update on public.accounts for each row execute function public.touch_updated_at();

alter table public.categories enable row level security;
revoke all on public.categories from public, anon, authenticated;
grant select, insert, update, delete on public.categories to authenticated;
create policy read_own on public.categories for select to authenticated using ((select auth.uid()) = user_id);
create policy insert_own on public.categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy update_own on public.categories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy delete_own on public.categories for delete to authenticated using ((select auth.uid()) = user_id);
create trigger touch before update on public.categories for each row execute function public.touch_updated_at();

alter table public.transactions enable row level security;
revoke all on public.transactions from public, anon, authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
create policy read_own on public.transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy insert_own on public.transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy update_own on public.transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy delete_own on public.transactions for delete to authenticated using ((select auth.uid()) = user_id);
create trigger touch before update on public.transactions for each row execute function public.touch_updated_at();

-- Este marcador persiste aunque la persona renombre o elimine las sugerencias.
create table public.onboarding (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.onboarding enable row level security;
revoke all on public.onboarding from public, anon, authenticated;
grant select, insert on public.onboarding to authenticated;
create policy read_own on public.onboarding for select to authenticated using ((select auth.uid()) = user_id);
create policy insert_own on public.onboarding for insert to authenticated with check ((select auth.uid()) = user_id);

create function public.initialize_space() returns void language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.onboarding values (auth.uid()) on conflict do nothing;
  if not found then return; end if;
  insert into public.accounts (name, kind) values ('Efectivo', 'cash') on conflict do nothing;
  insert into public.categories (name, type) values
    ('Sueldo', 'income'), ('Otros ingresos', 'income'), ('Alimentación', 'expense'),
    ('Transporte', 'expense'), ('Hogar', 'expense'), ('Otros gastos', 'expense') on conflict do nothing;
end;
$$;
revoke all on function public.initialize_space() from public, anon;
grant execute on function public.initialize_space() to authenticated;

create view public.account_balances with (security_invoker = true) as
select a.id, a.user_id, a.name, a.kind, a.opening_balance_cents::text,
  (a.opening_balance_cents + coalesce(sum(case when t.type = 'income' then t.amount_cents::numeric else -t.amount_cents::numeric end), 0))::text as balance_cents
from public.accounts a left join public.transactions t on (a.user_id, a.id) = (t.user_id, t.account_id)
group by a.id;

create view public.movement_history with (security_invoker = true) as
select t.id, t.user_id, t.type, t.amount_cents::text, t.occurred_on, t.description,
  a.id as account_id, a.name as account_name, c.id as category_id, c.name as category_name
from public.transactions t
join public.accounts a on (t.user_id, t.account_id) = (a.user_id, a.id)
join public.categories c on (t.user_id, t.category_id, t.type) = (c.user_id, c.id, c.type);
revoke all on public.account_balances, public.movement_history from public, anon, authenticated;
grant select on public.account_balances, public.movement_history to authenticated;

create function public.period_summary(start_date date, end_date date) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from (
    select (extract(day from t.occurred_on)::int - 1) / 7 + 1 as week,
      t.type, c.name as category_name, sum(t.amount_cents)::text as cents
    from public.transactions t join public.categories c
      on (t.user_id, t.category_id, t.type) = (c.user_id, c.id, c.type)
    where t.user_id = (select auth.uid()) and t.occurred_on between start_date and end_date
    group by 1, t.type, c.name
  ) s;
$$;
revoke all on function public.period_summary(date,date) from public, anon;
grant execute on function public.period_summary(date,date) to authenticated;
