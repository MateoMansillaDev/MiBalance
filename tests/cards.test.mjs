import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { localInstance } from './local-instance.mjs';

function ok(result) {
  assert.equal(result.error?.message ?? null, null);
  return result.data;
}
test('cuotas, cuentas en dólares, cotización, colores y aislamiento de dos usuarios', async (t) => {
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
  const { db, id: cash } = await user();
  const other = await user();
  const { id: food } = ok(
    await db
      .from('categories')
      .select('id')
      .eq('name', 'Alimentación')
      .single(),
  );
  const { id: card } = ok(
    await db
      .from('accounts')
      .insert({ name: 'Visa', kind: 'credit' })
      .select('id')
      .single(),
  );
  const { id: dollars } = ok(
    await db
      .from('accounts')
      .insert({ name: 'Dólares', kind: 'cash', currency: 'USD' })
      .select('id')
      .single(),
  );

  // Cuotas: tres filas de una compra, sin duplicar ante un reintento.
  const group = randomUUID();
  const cuota = (n, date) => ({
    account_id: card,
    category_id: food,
    type: 'expense',
    amount_cents: '1000',
    occurred_on: date,
    installment_group: group,
    installment_number: n,
    installment_count: 3,
  });
  const rows = [cuota(1, '2024-01-31'), cuota(2, '2024-02-29'), cuota(3, '2024-03-31')];
  ok(await db.from('transactions').insert(rows));
  assert.equal((await db.from('transactions').insert(rows)).error?.code, '23505');
  assert.ok((await db.from('transactions').insert({ ...cuota(4, '2024-04-30') })).error);
  assert.ok(
    (await db.from('transactions').insert({ ...cuota(1, '2024-01-31'), installment_group: null }))
      .error,
  );

  // Moneda: una transferencia entre pesos y dólares se rechaza; un cambio de moneda se registra.
  assert.ok(
    (
      await db.from('transfers').insert({
        source_id: cash,
        destination_id: dollars,
        amount_cents: 100,
        occurred_on: '2024-02-01',
      })
    ).error,
  );
  const exchange = {
    source_id: cash,
    source_currency: 'ARS',
    destination_id: dollars,
    destination_currency: 'USD',
    source_cents: 1200000,
    destination_cents: 1000,
    occurred_on: '2024-02-01',
  };
  ok(await db.from('exchanges').insert(exchange));
  assert.ok(
    (await db.from('exchanges').insert({ ...exchange, destination_id: card, destination_currency: 'ARS' }))
      .error,
  );
  assert.ok(
    (await db.from('exchanges').insert({ ...exchange, destination_currency: 'ARS' })).error,
  );
  ok(
    await db.from('transactions').insert({
      account_id: dollars,
      category_id: food,
      type: 'expense',
      amount_cents: '300',
      occurred_on: '2024-02-10',
    }),
  );
  const balances = Object.fromEntries(
    ok(await db.from('account_balances').select('id,balance_cents,currency')).map((a) => [
      a.id,
      a.balance_cents + ' ' + a.currency,
    ]),
  );
  assert.deepEqual(balances, {
    [cash]: '-1200000 ARS',
    [card]: '-3000 ARS',
    [dollars]: '700 USD',
  });
  assert.equal(
    (await db.from('accounts').update({ currency: 'ARS' }).eq('id', dollars)).error?.code,
    '23503',
  );

  // Los resúmenes en pesos no suman movimientos en dólares.
  const summary = ok(
    await db.rpc('period_summary', { start_date: '2024-02-01', end_date: '2024-02-29' }),
  );
  assert.equal(summary.length, 1);
  assert.equal(summary[0].cents, '1000');
  assert.deepEqual(ok(await db.rpc('filtered_totals', { criteria: {} })), {
    income: '0',
    expense: '3000',
  });
  assert.deepEqual(
    ok(await db.rpc('monthly_totals', { start_date: '2024-01-01', end_date: '2024-03-31' })),
    [
      { month: '2024-01', income: '0', expense: '1000' },
      { month: '2024-02', income: '0', expense: '1000' },
      { month: '2024-03', income: '0', expense: '1000' },
    ],
  );

  // Cotización y colores.
  ok(await db.from('exchange_rates').upsert({ ars_cents_per_usd: 123450, updated_on: '2024-02-01' }));
  assert.ok(
    (await db.from('exchange_rates').upsert({ ars_cents_per_usd: 0, updated_on: '2024-02-01' })).error,
  );
  ok(await db.from('categories').update({ color: '#6d3fe0', icon: 'cart' }).eq('id', food));
  assert.ok((await db.from('categories').update({ color: 'violeta' }).eq('id', food)).error);
  assert.ok((await db.from('categories').update({ icon: 'cohete' }).eq('id', food)).error);

  // Aislamiento: el segundo usuario no ve ni modifica nada de lo anterior.
  for (const table of ['exchanges', 'exchange_rates']) {
    assert.deepEqual(ok(await other.db.from(table).select('*')), []);
    assert.ok((await local.publicClient().from(table).select('*')).error);
  }
  assert.ok(
    (
      await other.db.from('exchanges').insert({ ...exchange, source_id: other.id })
    ).error,
  );
  assert.deepEqual(
    ok(await other.db.from('transactions').delete().eq('installment_group', group).select('id')),
    [],
  );
  assert.deepEqual(ok(await other.db.rpc('monthly_totals', { start_date: '2024-01-01', end_date: '2024-03-31' })), []);
});
