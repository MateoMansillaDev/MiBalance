import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const container = 'supabase_db_MiBalance';
function pg(program, args, input) {
  return execFileSync(
    'docker',
    ['exec', '-i', container, program, '-U', 'postgres', ...args],
    { input, maxBuffer: 16 * 1024 * 1024 },
  );
}
function sql(db, input) {
  return pg(
    'psql',
    ['-X', '-qAt', '--set=ON_ERROR_STOP=1', '--dbname', db],
    input,
  )
    .toString()
    .trim();
}
test('recuperación del esquema financiero en una base descartable', (t) => {
  const uid = randomUUID(),
    a = randomUUID(),
    b = randomUUID(),
    c = randomUUID();
  const suffix = randomUUID().replaceAll('-', '');
  const source = 'mb_backup_src_' + suffix,
    target = 'mb_backup_dst_' + suffix;
  const authSchema = pg('pg_dump', [
    '--schema-only',
    '--schema=auth',
    '--no-owner',
    '--no-privileges',
    'postgres',
  ]);
  const migrations = readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const db of [source, target]) {
    pg('createdb', [db]);
    t.after(() => pg('dropdb', [db]));
    sql(db, authSchema);
    sql(db, "insert into auth.users(id) values ('" + uid + "');");
    for (const file of migrations)
      sql(db, readFileSync('supabase/migrations/' + file));
  }
  sql(
    source,
    `
    insert into public.onboarding values ('${uid}');
    insert into public.accounts(id,user_id,name,kind) values ('${a}','${uid}','Caja','cash'), ('${b}','${uid}','Banco','bank');
    insert into public.categories(id,user_id,name,type) values ('${c}','${uid}','Viajes','expense');
    insert into public.transactions(user_id,account_id,category_id,type,amount_cents,occurred_on)
      values ('${uid}','${a}','${c}','expense',21,'2024-02-29');
    insert into public.budgets(user_id,month_start,category_id,limit_cents) values ('${uid}','2024-02-01','${c}',1000);
    insert into public.recurring_rules(user_id,account_id,category_id,type,amount_cents,frequency,starts_on,next_due)
      values ('${uid}','${a}','${c}','expense',20,'monthly','2024-02-29','2024-03-29');
    insert into public.saved_filters(user_id,name,query) values ('${uid}','Febrero','mes=2024-02');
    insert into public.transfers(user_id,source_id,destination_id,amount_cents,occurred_on)
      values ('${uid}','${a}','${b}',9007199254740993,'2024-02-29');
    insert into public.savings_goals(user_id,account_id,name,target_cents) values ('${uid}','${b}','Viaje',9900000000000000);`,
  );
  const archive = pg('pg_dump', [
    '--format=custom',
    '--data-only',
    '--schema=public',
    source,
  ]);
  pg(
    'pg_restore',
    [
      '--data-only',
      '--single-transaction',
      '--exit-on-error',
      '--dbname',
      target,
    ],
    archive,
  );
  const names = sql(
    source,
    "select tablename from pg_tables where schemaname='public' order by tablename",
  ).split(/\r?\n/);
  for (const table of [...names, 'account_balances']) {
    assert.match(table, /^[a-z_]+$/);
    const rows =
      'select to_jsonb(t)::text from public.' + table + ' t order by 1';
    assert.equal(sql(target, rows), sql(source, rows), table);
  }
});
