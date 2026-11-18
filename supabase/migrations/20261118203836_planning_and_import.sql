create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  month_start date not null check (extract(day from month_start) = 1),
  category_id uuid not null,
  category_type public.flow not null default 'expense' check (category_type = 'expense'),
  limit_cents bigint not null check (limit_cents > 0),
  unique (user_id, month_start, category_id),
  foreign key (user_id, category_id, category_type) references public.categories (user_id, id, type)
);
create index budgets_category on public.budgets (user_id, category_id, category_type);

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  account_id uuid not null,
  category_id uuid not null,
  type public.flow not null,
  amount_cents bigint not null check (amount_cents > 0),
  description text not null default '' check (length(description) <= 500),
  frequency text not null check (frequency in ('weekly','monthly')),
  starts_on date not null check (starts_on between date '1900-01-01' and date '9999-12-31'),
  next_due date not null check (next_due >= starts_on),
  foreign key (user_id, account_id) references public.accounts (user_id,id),
  foreign key (user_id, category_id, type) references public.categories (user_id,id,type)
);
create index recurring_due on public.recurring_rules (user_id,next_due);
create index recurring_account on public.recurring_rules (user_id,account_id);
create index recurring_category on public.recurring_rules (user_id,category_id,type);

create table public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  query text not null check (length(query) <= 1800),
  unique (user_id,name)
);

alter table public.budgets enable row level security;
revoke all on public.budgets from public,anon,authenticated;
grant select,insert,update,delete on public.budgets to authenticated;
create policy read_own on public.budgets for select to authenticated using ((select auth.uid()) = user_id);
create policy create_own on public.budgets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy edit_own on public.budgets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy remove_own on public.budgets for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.recurring_rules enable row level security;
revoke all on public.recurring_rules from public,anon,authenticated;
grant select,insert,update,delete on public.recurring_rules to authenticated;
create policy read_own on public.recurring_rules for select to authenticated using ((select auth.uid()) = user_id);
create policy create_own on public.recurring_rules for insert to authenticated with check ((select auth.uid()) = user_id);
create policy edit_own on public.recurring_rules for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy remove_own on public.recurring_rules for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.saved_filters enable row level security;
revoke all on public.saved_filters from public,anon,authenticated;
grant select,insert,update,delete on public.saved_filters to authenticated;
create policy read_own on public.saved_filters for select to authenticated using ((select auth.uid()) = user_id);
create policy create_own on public.saved_filters for insert to authenticated with check ((select auth.uid()) = user_id);
create policy edit_own on public.saved_filters for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy remove_own on public.saved_filters for delete to authenticated using ((select auth.uid()) = user_id);

create view public.monthly_budget_progress with (security_invoker=true) as
select b.id,b.user_id,b.month_start,b.category_id,c.name,b.limit_cents::text,
  coalesce(sum(t.amount_cents),0)::text as spent_cents
from public.budgets b join public.categories c on (c.user_id,c.id,c.type)=(b.user_id,b.category_id,b.category_type)
left join public.transactions t on (t.user_id,t.category_id,t.type)=(b.user_id,b.category_id,b.category_type)
  and t.occurred_on >= b.month_start and t.occurred_on < b.month_start + interval '1 month'
group by b.id,c.name;

create view public.recurring_schedule with (security_invoker=true) as
select r.id,r.user_id,r.frequency,r.next_due,r.type,r.description,r.amount_cents::text,
  c.name as category_name,a.name as account_name
from public.recurring_rules r join public.accounts a on (a.user_id,a.id)=(r.user_id,r.account_id)
join public.categories c on (c.user_id,c.id,c.type)=(r.user_id,r.category_id,r.type);
revoke all on public.monthly_budget_progress,public.recurring_schedule from public,anon,authenticated;
grant select on public.monthly_budget_progress,public.recurring_schedule to authenticated;

-- El bloqueo y el avance del cursor pertenecen a la misma transacción que las altas.
create function public.refresh_space() returns void language plpgsql security invoker set search_path='' as $$
declare
  rule public.recurring_rules%rowtype;
  cutoff date := (now() at time zone 'America/Argentina/Cordoba')::date;
  due_date date;
  next_month date;
begin
  perform public.initialize_space();
  for rule in select * from public.recurring_rules where user_id=(select auth.uid()) and next_due<=cutoff order by id for update loop
    due_date := rule.next_due;
    while due_date <= cutoff loop
      insert into public.transactions(account_id, category_id, type, amount_cents, occurred_on, description)
      values(rule.account_id,rule.category_id,rule.type,rule.amount_cents,due_date,rule.description);
      if rule.frequency='weekly' then
        due_date := due_date+7;
      else
        next_month := (date_trunc('month',due_date) + interval '1 month')::date;
        due_date := least(next_month + (extract(day from rule.starts_on)::int-1),
                          (next_month + interval '1 month - 1 day')::date);
      end if;
    end loop;
    update public.recurring_rules set next_due=due_date where id=rule.id;
  end loop;
end;
$$;

-- Una sola definición de los filtros para la tabla, sus totales y los archivos CSV.
create function public.filtered_history(criteria jsonb) returns setof public.movement_history
language sql stable security invoker set search_path='' as $$
  select h.* from public.movement_history h where h.user_id=(select auth.uid())
  and (not criteria ? 'desde' or h.occurred_on >= (criteria->>'desde')::date)
  and (not criteria ? 'hasta' or h.occurred_on <= (criteria->>'hasta')::date)
  and (not criteria ? 'tipo' or h.type=(criteria->>'tipo')::public.flow)
  and (not criteria ? 'cuenta' or h.account_id=(criteria->>'cuenta')::uuid)
  and (not criteria ? 'categoria' or h.category_id=(criteria->>'categoria')::uuid)
  and (not criteria ? 'q' or strpos(lower(h.description),lower(criteria->>'q'))>0);
$$;
create function public.filtered_totals(criteria jsonb) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'income', coalesce(sum(amount_cents::numeric) filter(where type='income'),0)::text,
    'expense', coalesce(sum(amount_cents::numeric) filter(where type='expense'),0)::text
  ) from public.filtered_history(criteria);
$$;

alter table public.transactions add column csv_key text check (length(csv_key)<=70);
create unique index transactions_csv_key on public.transactions(user_id,csv_key) where csv_key is not null;

create function public.csv_batch(items jsonb, apply_rows boolean) returns jsonb
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
       not exists(select from public.accounts a where a.user_id=owner_id and a.id=entry.account_id) or
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
revoke all on function public.refresh_space() from public,anon,authenticated;
grant execute on function public.refresh_space() to authenticated;
revoke all on function public.filtered_history(jsonb) from public,anon,authenticated;
grant execute on function public.filtered_history(jsonb) to authenticated;
revoke all on function public.filtered_totals(jsonb) from public,anon,authenticated;
grant execute on function public.filtered_totals(jsonb) to authenticated;
revoke all on function public.csv_batch(jsonb,boolean) from public,anon,authenticated;
grant execute on function public.csv_batch(jsonb,boolean) to authenticated;
