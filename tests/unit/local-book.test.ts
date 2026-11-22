import { describe, it, expect } from 'vitest';
import { Book, DomainError } from '../../src/local/book';
import { merge } from '../../src/local/merge';
import { emptyDoc, parseDoc } from '../../src/local/schema';
import {
  accountBalances,
  budgetProgress,
  filteredHistory,
  filteredTotals,
  monthlyTotals,
  periodSummary,
} from '../../src/local/views';

function clockFrom(start: number) {
  let t = start;
  return () => t++;
}
function book(device = 'a', start = 1000) {
  const b = new Book(emptyDoc(), device, clockFrom(start));
  b.initialize();
  return b;
}
const cashOf = (b: Book) => b.live('accounts').find((a) => a.name === 'Efectivo')!.id;
const categoryOf = (b: Book, name: string) => b.live('categories').find((c) => c.name === name)!.id;
const expense = (b: Book, account: string, amount: string, date: string) => ({
  type: 'expense' as const,
  account_id: account,
  category_id: categoryOf(b, 'Hogar'),
  amount_cents: amount,
  occurred_on: date,
  description: '',
});

describe('inicio', () => {
  it('crea Efectivo y seis categorías una sola vez, con ids iguales en cada dispositivo', () => {
    const a = book('a');
    a.initialize();
    expect(a.live('accounts')).toHaveLength(1);
    expect(a.live('categories')).toHaveLength(6);
    const b = book('b');
    const both = new Book(merge(a.doc, b.doc), 'c');
    expect(both.live('accounts')).toHaveLength(1);
    expect(both.live('categories')).toHaveLength(6);
  });
  it('conserva el marcador aunque se renombren o borren las sugerencias', () => {
    const a = book();
    a.removeCategory(categoryOf(a, 'Hogar'));
    a.initialize();
    expect(a.live('categories')).toHaveLength(5);
  });
});

describe('cuentas y categorías', () => {
  it('rechaza nombres repetidos sin distinguir mayúsculas', () => {
    const a = book();
    expect(() =>
      a.saveAccount(null, { name: ' efectivo ', kind: 'bank', currency: 'ARS', opening_balance_cents: '0' }),
    ).toThrow(DomainError);
  });
  it('bloquea borrar o cambiar de moneda una cuenta con historial', () => {
    const a = book();
    const cash = cashOf(a);
    a.saveMovement(null, expense(a, cash, '100', '2024-02-01'));
    expect(() => a.removeAccount(cash)).toThrow(DomainError);
    expect(() =>
      a.saveAccount(cash, { name: 'Efectivo', kind: 'cash', currency: 'USD', opening_balance_cents: '0' }),
    ).toThrow(DomainError);
  });
  it('no deja asociar una categoría de ingreso a un gasto', () => {
    const a = book();
    expect(() =>
      a.saveMovement(null, { ...expense(a, cashOf(a), '1', '2024-01-01'), category_id: categoryOf(a, 'Sueldo') }),
    ).toThrow(DomainError);
  });
  it.each(['0', '-1', '1.5', '', '9223372036854775808'])('rechaza el importe %s', (amount) => {
    const a = book();
    expect(() => a.saveMovement(null, expense(a, cashOf(a), amount, '2024-01-01'))).toThrow(DomainError);
  });
});

describe('cuotas, transferencias y dólares', () => {
  it('reparte cuotas exactas en meses sucesivos y no duplica un reintento', () => {
    const a = book();
    const card = a.saveAccount(null, { name: 'Visa', kind: 'credit', currency: 'ARS', opening_balance_cents: '0' }).id;
    a.addInstallments(expense(a, card, '1000', '2024-01-31'), 3, 'g1');
    a.addInstallments(expense(a, card, '1000', '2024-01-31'), 3, 'g1');
    const rows = a.live('transactions').sort((x, y) => x.occurred_on.localeCompare(y.occurred_on));
    expect(rows.map((r) => [r.occurred_on, r.amount_cents, r.installment_number])).toEqual([
      ['2024-01-31', '334', 1],
      ['2024-02-29', '333', 2],
      ['2024-03-31', '333', 3],
    ]);
    expect(() => a.addInstallments(expense(a, cashOf(a), '1000', '2024-01-31'), 3, 'g2')).toThrow(DomainError);
    a.removeInstallments('g1');
    expect(a.live('transactions')).toHaveLength(0);
  });
  it('transfiere solo entre la misma moneda y cambia pesos por dólares sin contarlo como gasto', () => {
    const a = book();
    const cash = cashOf(a);
    const usd = a.saveAccount(null, { name: 'Dólares', kind: 'cash', currency: 'USD', opening_balance_cents: '0' }).id;
    expect(() =>
      a.saveTransfer('t1', { source_id: cash, destination_id: usd, amount_cents: '1', occurred_on: '2024-02-01', description: '' }),
    ).toThrow(DomainError);
    a.saveExchange({ source_id: cash, destination_id: usd, source_cents: '120000', destination_cents: '100', occurred_on: '2024-02-01', description: '' });
    expect(() =>
      a.saveExchange({ source_id: cash, destination_id: cash, source_cents: '1', destination_cents: '1', occurred_on: '2024-02-01', description: '' }),
    ).toThrow(DomainError);
    a.saveMovement(null, expense(a, usd, '30', '2024-02-10'));
    const balances = Object.fromEntries(accountBalances(a).map((x) => [x.name, x.balance_cents]));
    expect(balances).toEqual({ Efectivo: '-120000', Dólares: '70' });
    expect(periodSummary(a, '2024-02-01', '2024-02-29')).toEqual([]);
    expect(filteredTotals(filteredHistory(a, {}))).toEqual({ income: 0n, expense: 0n });
  });
  it('una transferencia reintentada con el mismo id no se duplica', () => {
    const a = book();
    const bank = a.saveAccount(null, { name: 'Banco', kind: 'bank', currency: 'ARS', opening_balance_cents: '0' }).id;
    const input = { source_id: cashOf(a), destination_id: bank, amount_cents: '500', occurred_on: '2024-02-01', description: '' };
    a.saveTransfer('t1', input);
    a.saveTransfer('t1', input);
    expect(a.live('transfers')).toHaveLength(1);
    expect(accountBalances(a).find((x) => x.id === bank)!.balance_cents).toBe('500');
  });
});

describe('resúmenes', () => {
  it('suma por semana y mes, y calcula el gasto de cada presupuesto', () => {
    const a = book();
    const cash = cashOf(a);
    a.saveMovement(null, expense(a, cash, '100', '2024-02-29'));
    a.saveMovement(null, expense(a, cash, '9007199254740993', '2024-03-01'));
    const summary = periodSummary(a, '2024-02-01', '2024-02-29');
    expect(summary).toEqual([
      { week: 5, type: 'expense', category_name: 'Hogar', color: null, icon: null, cents: '100' },
    ]);
    expect(monthlyTotals(a, '2024-01-01', '2024-03-31')).toEqual([
      { month: '2024-02', income: '0', expense: '100' },
      { month: '2024-03', income: '0', expense: '9007199254740993' },
    ]);
    a.saveBudget('2024-02', categoryOf(a, 'Hogar'), '80');
    a.saveBudget('2024-02', categoryOf(a, 'Hogar'), '90');
    expect(budgetProgress(a, '2024-02')).toMatchObject([{ name: 'Hogar', limit_cents: '90', spent_cents: '100' }]);
    expect(() => a.saveBudget('2024-02', categoryOf(a, 'Sueldo'), '1')).toThrow(DomainError);
  });
});

describe('repeticiones', () => {
  it('registra los vencimientos del día 31 y dos dispositivos no los duplican', () => {
    const a = book('a');
    a.saveRule({ ...expense(a, cashOf(a), '50', '2024-01-31'), frequency: 'monthly' });
    const b = new Book(structuredClone(a.doc), 'b', clockFrom(5000));
    a.refresh('2024-04-30');
    b.refresh('2024-04-30');
    const both = new Book(merge(a.doc, b.doc), 'c');
    expect(both.live('transactions').map((t) => t.occurred_on).sort()).toEqual([
      '2024-01-31',
      '2024-02-29',
      '2024-03-31',
      '2024-04-30',
    ]);
    expect(both.live('rules')[0].next_due).toBe('2024-05-31');
  });
});

describe('sincronización', () => {
  it('la combinación es conmutativa e idempotente y respeta la última escritura', () => {
    const a = book('a', 1000);
    const b = new Book(structuredClone(a.doc), 'b', clockFrom(2000));
    a.saveAccount(null, { name: 'Banco', kind: 'bank', currency: 'ARS', opening_balance_cents: '0' });
    const cash = cashOf(b);
    b.saveAccount(cash, { name: 'Billetera', kind: 'cash', currency: 'ARS', opening_balance_cents: '0' });
    const ab = merge(a.doc, b.doc);
    expect(merge(b.doc, a.doc)).toEqual(ab);
    expect(merge(ab, ab)).toEqual(ab);
    expect(new Book(ab, 'c').live('accounts').map((x) => x.name).sort()).toEqual(['Banco', 'Billetera']);
  });
  it('un borrado posterior gana y se propaga como lápida', () => {
    const a = book('a', 1000);
    const id = a.saveMovement(null, expense(a, cashOf(a), '10', '2024-01-01')).id;
    const b = new Book(structuredClone(a.doc), 'b', clockFrom(9000));
    b.removeMovement(id);
    expect(new Book(merge(a.doc, b.doc), 'c').live('transactions')).toHaveLength(0);
  });
  it('valida el archivo leído y rechaza otro formato', () => {
    const a = book();
    expect(parseDoc(JSON.stringify(a.doc))).toEqual(a.doc);
    expect(() => parseDoc('{"format":"otro"}')).toThrow();
    const broken = JSON.parse(JSON.stringify(a.doc));
    Object.values(broken.collections.accounts as Record<string, { opening_balance_cents: string }>)[0].opening_balance_cents = '1,5';
    expect(() => parseDoc(JSON.stringify(broken))).toThrow();
  });
});

describe('CSV', () => {
  it('omite duplicados por referencia y por contenido, y rechaza cuentas en dólares', () => {
    const a = book();
    const row = { ...expense(a, cashOf(a), '100', '2024-02-01'), reference: null };
    expect(a.csvBatch([row, row], true)).toEqual([false, true]);
    expect(a.csvBatch([row], true)).toEqual([true]);
    const ref = { ...row, amount_cents: '200', reference: '00000000-0000-4000-8000-000000000001' };
    expect(a.csvBatch([ref, ref], true)).toEqual([false, true]);
    expect(a.live('transactions')).toHaveLength(2);
    const usd = a.saveAccount(null, { name: 'USD', kind: 'cash', currency: 'USD', opening_balance_cents: '0' }).id;
    expect(() => a.csvBatch([{ ...row, account_id: usd }], false)).toThrow(DomainError);
  });
});
