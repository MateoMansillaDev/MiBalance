import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { localInstance } from './local-instance.mjs';

function ok(result) {
  assert.equal(result.error?.message ?? null, null);
  return result.data;
}
test('Auth real, exactitud, integridad y aislamiento con dos usuarios locales', async (t) => {
  const local = localInstance();
  async function signup() {
    const db = local.publicClient();
    const data = ok(
      await db.auth.signUp({
        email: 'db-' + randomUUID() + '@example.test',
        password: randomUUID(),
      }),
    );
    t.after(async () => {
      ok(await local.admin.auth.admin.deleteUser(data.user.id));
    });
    return db;
  }
  const first = await signup(),
    second = await signup();
  await Promise.all([
    first.rpc('initialize_space'),
    first.rpc('initialize_space'),
    second.rpc('initialize_space'),
  ]).then((rs) => rs.forEach(ok));
  const account = ok(await first.from('accounts').select('id').single());
  const cat = ok(
    await first.from('categories').select('id').eq('name', 'Sueldo').single(),
  );
  const otherAccount = ok(await second.from('accounts').select('id').single());
  const tx = {
    account_id: account.id,
    category_id: cat.id,
    type: 'income',
    amount_cents: '9007199254740993',
    occurred_on: '2024-02-29',
    description: 'Integración local',
  };
  ok(
    await first
      .from('accounts')
      .update({ opening_balance_cents: '-1' })
      .eq('id', account.id),
  );
  const row = ok(
    await first.from('transactions').insert(tx).select('id').single(),
  );
  const balance = ok(
    await first.from('account_balances').select('balance_cents').single(),
  );
  assert.equal(balance.balance_cents, '9007199254740992');
  const summary = ok(
    await first.rpc('period_summary', {
      start_date: '2024-02-01',
      end_date: '2024-02-29',
    }),
  );
  assert.equal(summary[0].cents, tx.amount_cents);
  assert.deepEqual(
    ok(
      await second.rpc('period_summary', {
        start_date: '2024-02-01',
        end_date: '2024-02-29',
      }),
    ),
    [],
  );
  assert.deepEqual(
    ok(
      await first.rpc('period_summary', {
        start_date: '2024-03-01',
        end_date: '2024-03-31',
      }),
    ),
    [],
  );
  for (const [table, id, patch] of [
    ['transactions', row.id, { description: 'Modificación de prueba' }],
    ['accounts', account.id, { name: 'Cambio' }],
    ['categories', cat.id, { name: 'Cambio' }],
  ]) {
    assert.deepEqual(
      ok(await second.from(table).select('id').eq('id', id)),
      [],
    );
    assert.deepEqual(
      ok(await second.from(table).update(patch).eq('id', id).select('id')),
      [],
    );
    assert.deepEqual(
      ok(await second.from(table).delete().eq('id', id).select('id')),
      [],
    );
    assert.ok((await local.publicClient().from(table).select('id')).error);
  }
  assert.deepEqual(
    ok(await second.from('movement_history').select('id').eq('id', row.id)),
    [],
  );
  assert.deepEqual(
    ok(await second.from('account_balances').select('id').eq('id', account.id)),
    [],
  );
  assert.equal(
    (
      await first
        .from('transactions')
        .insert({ ...tx, account_id: otherAccount.id })
    ).error?.code,
    '23503',
  );
  assert.equal(
    (await first.from('transactions').insert({ ...tx, type: 'expense' })).error
      ?.code,
    '23503',
  );
  assert.equal(
    (await first.from('transactions').insert({ ...tx, amount_cents: '0' }))
      .error?.code,
    '23514',
  );
  assert.equal(
    (await first.from('accounts').delete().eq('id', account.id)).error?.code,
    '23503',
  );
  assert.equal(
    (await first.from('categories').delete().eq('id', cat.id)).error?.code,
    '23503',
  );
  ok(await first.from('transactions').delete().eq('id', row.id));
  ok(await first.from('accounts').delete().eq('id', account.id));
  ok(await first.rpc('initialize_space'));
  assert.deepEqual(ok(await first.from('accounts').select('id')), []);
});
