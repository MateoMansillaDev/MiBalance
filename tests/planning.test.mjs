import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { localInstance } from './local-instance.mjs';

function ok(result) {
  assert.equal(result.error?.message ?? null, null);
  return result.data;
}

test('presupuestos, vencimientos, importación atómica, reportes y RLS', async (t) => {
  const instance = localInstance();
  async function space() {
    const db = instance.publicClient();
    const { user } = ok(
      await db.auth.signUp({
        email: 'plan-' + randomUUID() + '@example.test',
        password: randomUUID(),
      }),
    );
    t.after(async () =>
      ok(await instance.admin.auth.admin.deleteUser(user.id)),
    );
    ok(await db.rpc('refresh_space'));
    const a = ok(await db.from('accounts').select('id').single());
    const c = ok(
      await db.from('categories').select('id').eq('name', 'Hogar').single(),
    );
    return { db, a: a.id, c: c.id };
  }
  const { db, a, c } = await space();
  const other = await space();
  const budget = ok(
    await db
      .from('budgets')
      .insert({
        month_start: '2024-02-01',
        category_id: c,
        limit_cents: '10001',
      })
      .select('id')
      .single(),
  );
  assert.ok(
    (
      await other.db
        .from('budgets')
        .insert({ month_start: '2024-02-01', category_id: c, limit_cents: 100 })
    ).error,
  );
  const rule = ok(
    await db
      .from('recurring_rules')
      .insert({
        type: 'expense',
        frequency: 'monthly',
        starts_on: '2024-01-31',
        next_due: '2024-01-31',
        account_id: a,
        category_id: c,
        amount_cents: '8001',
        description: 'Regla mensual',
      })
      .select('id')
      .single(),
  );
  const saved = ok(
    await db
      .from('saved_filters')
      .insert({ name: 'Mi filtro', query: 'tipo=expense' })
      .select('id')
      .single(),
  );
  for (const [table, id, patch] of [
    ['budgets', budget.id, { limit_cents: 1 }],
    ['recurring_rules', rule.id, { description: 'Cambio' }],
    ['saved_filters', saved.id, { name: 'Cambio' }],
  ]) {
    assert.deepEqual(
      ok(await other.db.from(table).select('id').eq('id', id)),
      [],
    );
    assert.deepEqual(
      ok(await other.db.from(table).update(patch).eq('id', id).select('id')),
      [],
    );
    assert.deepEqual(
      ok(await other.db.from(table).delete().eq('id', id).select('id')),
      [],
    );
    assert.ok((await instance.publicClient().from(table).select('id')).error);
  }
  const calls = await Promise.all([
    db.rpc('refresh_space'),
    db.rpc('refresh_space'),
  ]);
  calls.forEach(ok);
  const posted = ok(
    await db.from('transactions').select('occurred_on').order('occurred_on'),
  );
  assert.deepEqual(
    posted.slice(0, 3).map((r) => r.occurred_on),
    ['2024-01-31', '2024-02-29', '2024-03-31'],
  );
  assert.equal(new Set(posted.map((r) => r.occurred_on)).size, posted.length);
  const now = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Cordoba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  assert.ok(posted.at(-1).occurred_on <= now);
  assert.ok(
    ok(await db.from('recurring_schedule').select('next_due').single())
      .next_due > now,
  );
  assert.equal(
    ok(await db.from('monthly_budget_progress').select('spent_cents').single())
      .spent_cents,
    '8001',
  );
  const row = {
    reference: null,
    occurred_on: '2024-02-01',
    account_id: a,
    category_id: c,
    type: 'expense',
    description: 'Prueba % literal',
    amount_cents: '9007199254740993',
  };
  function batch(items, apply_rows, client = db) {
    return client.rpc('csv_batch', { items, apply_rows });
  }
  assert.deepEqual(ok(await batch([row, row], false)), [false, true]);
  assert.equal(
    ok(await db.from('monthly_budget_progress').select('spent_cents').single())
      .spent_cents,
    '8001',
  );
  assert.ok((await batch([row, { ...row, account_id: other.a }], true)).error);
  assert.deepEqual(ok(await batch([row], false)), [false]);
  const concurrent = await Promise.all([
    batch([row], true),
    batch([row], true),
  ]);
  assert.deepEqual(concurrent.map((r) => ok(r)[0]).sort(), [false, true]);
  assert.deepEqual(ok(await batch([row], true)), [true]);
  assert.ok((await batch([row], true, other.db)).error);
  const criteria = {
    desde: '2024-02-01',
    hasta: '2024-02-29',
    cuenta: a,
    categoria: c,
    tipo: 'expense',
    q: '%',
  };
  const rows = ok(await db.rpc('filtered_history', { criteria }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount_cents, row.amount_cents);
  assert.deepEqual(ok(await db.rpc('filtered_totals', { criteria })), {
    income: '0',
    expense: row.amount_cents,
  });
  assert.deepEqual(
    ok(await other.db.rpc('filtered_history', { criteria })),
    [],
  );
  assert.deepEqual(ok(await batch([{ ...row, reference: rows[0].id }], true)), [
    true,
  ]);
  ok(
    await db
      .from('transactions')
      .update({ amount_cents: '1' })
      .eq('id', rows[0].id),
  );
  assert.deepEqual(ok(await batch([row], true)), [true]);
  ok(await db.from('recurring_rules').delete().eq('id', rule.id));
  const firstWeek = new Date(now + 'T12:00:00Z');
  firstWeek.setUTCDate(firstWeek.getUTCDate() - 7);
  const weeklyStart = firstWeek.toISOString().slice(0, 10);
  ok(
    await db.from('recurring_rules').insert({
      account_id: a,
      category_id: c,
      type: 'expense',
      amount_cents: '1',
      description: 'Semanal',
      frequency: 'weekly',
      starts_on: weeklyStart,
      next_due: weeklyStart,
    }),
  );
  ok(await db.rpc('refresh_space'));
  const weekly = ok(
    await db
      .from('transactions')
      .select('id,occurred_on')
      .eq('description', 'Semanal')
      .order('occurred_on'),
  );
  assert.deepEqual(
    weekly.map((tx) => tx.occurred_on),
    [weeklyStart, now],
  );
  ok(await db.from('transactions').delete().eq('id', weekly[0].id));
  ok(await db.rpc('refresh_space'));
  assert.equal(
    ok(await db.from('transactions').select('id').eq('description', 'Semanal'))
      .length,
    1,
  );

  const bulkRow = {
    account_id: a,
    category_id: c,
    type: 'expense',
    occurred_on: '2024-05-05',
    amount_cents: '2',
    description: 'Reporte completo',
  };
  ok(
    await db
      .from('transactions')
      .insert(Array.from({ length: 1001 }, () => bulkRow)),
  );
  const bulkCriteria = { q: bulkRow.description };
  const lastPage = await db
    .rpc('filtered_history', { criteria: bulkCriteria }, { count: 'exact' })
    .order('id')
    .range(1000, 1019);
  assert.equal(ok(lastPage).length, 1);
  assert.equal(lastPage.count, 1001);
  assert.equal(
    ok(await db.rpc('filtered_totals', { criteria: bulkCriteria })).expense,
    '2002',
  );
  assert.equal(
    ok(
      await db
        .from('transactions')
        .select('id')
        .eq('description', 'Regla mensual'),
    ).length,
    posted.length,
  );
});
