import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { localInstance } from './local-instance.mjs';

function ok(result) {
  assert.equal(result.error?.message ?? null, null);
  return result.data;
}
test('transferencias atómicas, saldos exactos, metas y aislamiento de dos usuarios', async (t) => {
  const local = localInstance();
  async function user() {
    const db = local.publicClient();
    const signup = ok(
      await db.auth.signUp({
        email: randomUUID() + '@example.test',
        password: randomUUID(),
      }),
    );
    t.after(async () =>
      ok(await local.admin.auth.admin.deleteUser(signup.user.id)),
    );
    ok(await db.rpc('refresh_space'));
    const { id } = ok(await db.from('accounts').select('id').single());
    return { db, id };
  }
  const { db, id: source } = await user();
  const other = await user();
  const { id: destination } = ok(
    await db
      .from('accounts')
      .insert({ name: 'Banco', kind: 'bank' })
      .select('id')
      .single(),
  );
  const tid = randomUUID();
  const amount = '9007199254740993';
  const row = {
    id: tid,
    source_id: source,
    destination_id: destination,
    occurred_on: '2024-02-29',
    amount_cents: amount,
  };
  const writes = await Promise.all([
    db.from('transfers').insert(row),
    db.from('transfers').insert(row),
  ]);
  assert.deepEqual(writes.map((r) => r.error?.code ?? 'ok').sort(), [
    '23505',
    'ok',
  ]);
  const goal = ok(
    await db
      .from('savings_goals')
      .insert({ account_id: destination, name: 'Ahorro', target_cents: amount })
      .select('id,target_cents::text')
      .single(),
  );
  assert.equal(goal.target_cents, amount);
  for (const [table, id, patch] of [
    ['transfers', tid, { amount_cents: 2 }],
    ['savings_goals', goal.id, { target_cents: 2 }],
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
    assert.ok((await local.publicClient().from(table).select('id')).error);
  }
  for (const patch of [
    { destination_id: source },
    { destination_id: other.id },
    { amount_cents: 0 },
  ])
    assert.ok(
      (
        await db
          .from('transfers')
          .insert({ ...row, id: randomUUID(), ...patch })
      ).error,
    );
  assert.ok(
    (
      await db
        .from('savings_goals')
        .insert({ account_id: other.id, name: 'Otra', target_cents: 3 })
    ).error,
  );
  assert.ok((await db.from('accounts').delete().eq('id', destination)).error);
  async function balances() {
    return Object.fromEntries(
      ok(await db.from('account_balances').select('id,balance_cents')).map(
        (a) => [a.id, a.balance_cents],
      ),
    );
  }
  assert.deepEqual(await balances(), {
    [source]: '-' + amount,
    [destination]: amount,
  });
  assert.deepEqual(
    ok(
      await db.rpc('period_summary', {
        start_date: '2024-02-01',
        end_date: '2024-02-29',
      }),
    ),
    [],
  );
  assert.deepEqual(ok(await db.rpc('filtered_totals', { criteria: {} })), {
    income: '0',
    expense: '0',
  });
  ok(await db.from('transfers').delete().eq('id', tid));
  assert.deepEqual(await balances(), { [source]: '0', [destination]: '0' });
});
