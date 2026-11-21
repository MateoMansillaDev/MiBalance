-- Fase 4: tarjetas y cuotas, cuentas en dólares, cotización de referencia,
-- colores e íconos de categoría y totales mensuales para la tendencia.

-- Tarjetas de crédito: una cuenta más, cuyo saldo negativo es la deuda.
alter type public.account_kind add value if not exists 'credit';

-- Moneda por cuenta. Los resúmenes, presupuestos y reportes siguen en ARS.
alter table public.accounts
  add column currency text not null default 'ARS' check (currency in ('ARS', 'USD'));
alter table public.accounts add constraint accounts_user_id_id_currency_key unique (user_id, id, currency);

-- Las transferencias solo mueven dinero entre cuentas de la misma moneda.
alter table public.transfers add column currency text not null default 'ARS';
alter table public.transfers
  add constraint transfers_source_currency foreign key (user_id, source_id, currency)
    references public.accounts (user_id, id, currency),
  add constraint transfers_destination_currency foreign key (user_id, destination_id, currency)
    references public.accounts (user_id, id, currency);

-- Compra y venta de dólares: dos importes, uno por moneda. No es ingreso ni gasto.
create table public.exchanges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source_id uuid not null,
  source_currency text not null,
  destination_id uuid not null,
  destination_currency text not null,
  source_cents bigint not null check (source_cents > 0),
  destination_cents bigint not null check (destination_cents > 0),
  occurred_on date not null check (occurred_on between date '1000-01-01' and date '9999-12-31'),
  description text not null default '' check (length(description) <= 500),
  check (source_currency <> destination_currency),
  foreign key (user_id, source_id, source_currency) references public.accounts (user_id, id, currency),
  foreign key (user_id, destination_id, destination_currency) references public.accounts (user_id, id, currency)
);
create index exchanges_history on public.exchanges (user_id, occurred_on desc, id desc);
create index exchanges_source on public.exchanges (user_id, source_id);
create index exchanges_destination on public.exchanges (user_id, destination_id);
alter table public.exchanges enable row level security;
revoke all on public.exchanges from public, anon, authenticated;
grant select, insert, update, delete on public.exchanges to authenticated;
create policy read_own on public.exchanges for select to authenticated using ((select auth.uid()) = user_id);
create policy insert_own on public.exchanges for insert to authenticated with check ((select auth.uid()) = user_id);
create policy update_own on public.exchanges for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy delete_own on public.exchanges for delete to authenticated using ((select auth.uid()) = user_id);

-- Cotización de referencia que carga la persona: centavos de peso por cada dólar.
create table public.exchange_rates (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  ars_cents_per_usd bigint not null check (ars_cents_per_usd > 0),
  updated_on date not null check (updated_on between date '1000-01-01' and date '9999-12-31')
);
alter table public.exchange_rates enable row level security;
revoke all on public.exchange_rates from public, anon, authenticated;
grant select, insert, update, delete on public.exchange_rates to authenticated;
create policy read_own on public.exchange_rates for select to authenticated using ((select auth.uid()) = user_id);
create policy insert_own on public.exchange_rates for insert to authenticated with check ((select auth.uid()) = user_id);
create policy update_own on public.exchange_rates for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy delete_own on public.exchange_rates for delete to authenticated using ((select auth.uid()) = user_id);

-- Una cuenta con historial no cambia de moneda: sus importes perderían sentido.
create function public.lock_account_currency() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.currency is distinct from old.currency and (
    exists (select from public.transactions t where t.user_id = old.user_id and t.account_id = old.id)
    or exists (select from public.transfers t where t.user_id = old.user_id and old.id in (t.source_id, t.destination_id))
    or exists (select from public.exchanges e where e.user_id = old.user_id and old.id in (e.source_id, e.destination_id))
    or exists (select from public.recurring_rules r where r.user_id = old.user_id and r.account_id = old.id)
    or exists (select from public.savings_goals g where g.user_id = old.user_id and g.account_id = old.id)
  ) then
    raise exception 'La cuenta tiene historial y no puede cambiar de moneda' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function public.lock_account_currency() from public, anon, authenticated;
create trigger lock_currency before update of currency on public.accounts
  for each row execute function public.lock_account_currency();

-- Compras en cuotas: cada cuota es un gasto en su mes, agrupado por compra.
alter table public.transactions
  add column installment_group uuid,
  add column installment_number smallint,
  add column installment_count smallint,
  add constraint transactions_installments check (
    (installment_group is null and installment_number is null and installment_count is null)
    or (installment_group is not null and installment_count between 2 and 60
        and installment_number between 1 and installment_count)
  );
create unique index transactions_installment on public.transactions (user_id, installment_group, installment_number)
  where installment_group is not null;

-- Colores e íconos opcionales para reconocer las categorías.
alter table public.categories
  add column color text check (color ~ '^#[0-9a-f]{6}$'),
  add column icon text check (icon in ('tag', 'briefcase', 'gift', 'cart', 'bus', 'home', 'utensils',
    'heart', 'bolt', 'film', 'shirt', 'book', 'plane', 'paw', 'phone', 'piggy'));

-- Saldos: movimientos, transferencias y cambios de moneda, cada uno una vez por lado.
create or replace view public.account_balances with (security_invoker = true) as
select a.id, a.user_id, a.name, a.kind, a.opening_balance_cents::text,
  (a.opening_balance_cents + coalesce(sum(f.delta), 0))::text as balance_cents,
  a.currency
from public.accounts a
left join (
  select user_id, account_id, case when type = 'income' then amount_cents::numeric else -amount_cents::numeric end as delta
  from public.transactions
  union all
  select user_id, source_id, -amount_cents::numeric from public.transfers
  union all
  select user_id, destination_id, amount_cents::numeric from public.transfers
  union all
  select user_id, source_id, -source_cents::numeric from public.exchanges
  union all
  select user_id, destination_id, destination_cents::numeric from public.exchanges
) f on (a.user_id, a.id) = (f.user_id, f.account_id)
group by a.id;

create or replace view public.movement_history with (security_invoker = true) as
select t.id, t.user_id, t.type, t.amount_cents::text, t.occurred_on, t.description,
  a.id as account_id, a.name as account_name, c.id as category_id, c.name as category_name,
  a.currency, t.installment_group, t.installment_number, t.installment_count,
  c.color as category_color, c.icon as category_icon
from public.transactions t
join public.accounts a on (t.user_id, t.account_id) = (a.user_id, a.id)
join public.categories c on (t.user_id, t.category_id, t.type) = (c.user_id, c.id, c.type);

-- Resumen mensual: solo cuentas en pesos, con color e ícono de la categoría.
create or replace function public.period_summary(start_date date, end_date date) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from (
    select (extract(day from t.occurred_on)::int - 1) / 7 + 1 as week,
      t.type, c.name as category_name, c.color, c.icon, sum(t.amount_cents)::text as cents
    from public.transactions t
    join public.categories c on (t.user_id, t.category_id, t.type) = (c.user_id, c.id, c.type)
    join public.accounts a on (t.user_id, t.account_id) = (a.user_id, a.id)
    where t.user_id = (select auth.uid()) and a.currency = 'ARS'
      and t.occurred_on between start_date and end_date
    group by 1, t.type, c.name, c.color, c.icon
  ) s;
$$;

create or replace function public.filtered_totals(criteria jsonb) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'income', coalesce(sum(amount_cents::numeric) filter (where type = 'income'), 0)::text,
    'expense', coalesce(sum(amount_cents::numeric) filter (where type = 'expense'), 0)::text
  ) from public.filtered_history(criteria) where currency = 'ARS';
$$;

create or replace view public.monthly_budget_progress with (security_invoker = true) as
select b.id, b.user_id, b.month_start, b.category_id, c.name, b.limit_cents::text,
  coalesce(sum(t.amount_cents), 0)::text as spent_cents
from public.budgets b
join public.categories c on (c.user_id, c.id, c.type) = (b.user_id, b.category_id, b.category_type)
left join (
  public.transactions t join public.accounts a
    on (a.user_id, a.id) = (t.user_id, t.account_id) and a.currency = 'ARS'
) on (t.user_id, t.category_id, t.type) = (b.user_id, b.category_id, b.category_type)
  and t.occurred_on >= b.month_start and t.occurred_on < b.month_start + interval '1 month'
group by b.id, c.name;

-- Ingresos y gastos en pesos por mes, para la tendencia.
create function public.monthly_totals(start_date date, end_date date) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(s) order by s.month), '[]'::jsonb) from (
    select to_char(t.occurred_on, 'YYYY-MM') as month,
      coalesce(sum(t.amount_cents::numeric) filter (where t.type = 'income'), 0)::text as income,
      coalesce(sum(t.amount_cents::numeric) filter (where t.type = 'expense'), 0)::text as expense
    from public.transactions t
    join public.accounts a on (t.user_id, t.account_id) = (a.user_id, a.id)
    where t.user_id = (select auth.uid()) and a.currency = 'ARS'
      and t.occurred_on between start_date and end_date
    group by 1
  ) s;
$$;
revoke all on function public.monthly_totals(date, date) from public, anon, authenticated;
grant execute on function public.monthly_totals(date, date) to authenticated;


-- El CSV intercambia importes en pesos: solo admite cuentas en ARS.
create or replace function public.csv_batch(items jsonb, apply_rows boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  entry record;
  owner_id uuid := auth.uid();
  content_key text;
  import_key text;
  duplicate boolean;
  seen_keys text[] := '{}';
  seen_content text[] := '{}';
  skipped boolean[] := '{}';
begin
  if owner_id is null or jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) not between 1 and 300 then
    raise exception 'Lote inválido' using errcode='22023';
  end if;
  if apply_rows then perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 2)); end if;
  for entry in select * from jsonb_to_recordset(items) as x(
    reference uuid, account_id uuid,category_id uuid,type public.flow,amount_cents bigint, occurred_on date,description text
  ) loop
    if entry.amount_cents is null or entry.amount_cents <= 0 or entry.occurred_on is null or
       entry.description is null or length(entry.description)>500 or
       not exists(select from public.accounts a where a.user_id=owner_id and a.id=entry.account_id and a.currency='ARS') or
       not exists(select from public.categories c where c.user_id=owner_id and c.id=entry.category_id and c.type=entry.type) then
      raise exception 'Fila inválida' using errcode='22023';
    end if;
    content_key := encode(sha256(convert_to(jsonb_build_array(entry.account_id,entry.category_id,entry.type,
      entry.amount_cents,entry.occurred_on,entry.description)::text,'UTF8')),'hex');
    import_key := coalesce('id:'||entry.reference::text,content_key);
    duplicate := import_key=any(seen_keys) or exists(select from public.transactions t
      where t.user_id=owner_id and (t.csv_key=import_key or t.id=entry.reference));
    if entry.reference is null and not duplicate then
      duplicate := content_key=any(seen_content) or exists(select from public.transactions t where
        (t.user_id,t.account_id,t.category_id,t.type,t.amount_cents,t.occurred_on,t.description)=
        (owner_id,entry.account_id,entry.category_id,entry.type,entry.amount_cents,entry.occurred_on,entry.description));
    end if;
    if apply_rows and not duplicate then
      insert into public.transactions(account_id,category_id,type,amount_cents,occurred_on,description,csv_key)
      values(entry.account_id,entry.category_id,entry.type,entry.amount_cents,entry.occurred_on,entry.description,import_key)
      on conflict(user_id,csv_key) where csv_key is not null do nothing;
      duplicate := not found;
    end if;
    seen_keys := array_append(seen_keys,import_key);
    seen_content := array_append(seen_content,content_key);
    skipped := array_append(skipped,duplicate);
  end loop;
  return to_jsonb(skipped);
end;
$$;
