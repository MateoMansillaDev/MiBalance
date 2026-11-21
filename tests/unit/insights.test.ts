import { describe, it, expect } from 'vitest';
import { money, splitInstallments, usdToArs } from '../../src/lib/money';
import { addDays, addMonths } from '../../src/lib/dates';
import {
  categoryChanges,
  occurrences,
  pendingRecurring,
  type RecurringRule,
} from '../../src/lib/insights';

describe('cuotas', () => {
  it('reparte centavos exactos y suma el total', () => {
    const parts = splitInstallments(1000n, 3);
    expect(parts).toEqual([334n, 333n, 333n]);
    expect(parts.reduce((a, b) => a + b)).toBe(1000n);
  });
  it('conserva importes por encima del rango seguro de Number', () => {
    const total = 9223372036854775807n;
    expect(splitInstallments(total, 7).reduce((a, b) => a + b)).toBe(total);
  });
  it.each([
    [1000n, 1],
    [1000n, 61],
    [5n, 6],
    [1000n, 2.5],
  ])('rechaza %s en %s cuotas', (total, count) => {
    expect(() => splitInstallments(total, count)).toThrow();
  });
});

describe('fechas de vencimiento', () => {
  it('suma meses y usa el último día en meses cortos', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2023-01-31', 1)).toBe('2023-02-28');
    expect(addMonths('2024-01-31', 2)).toBe('2024-03-31');
    expect(addMonths('2024-11-15', 3)).toBe('2025-02-15');
    expect(addMonths('2024-03-01', -5)).toBe('2023-10-01');
  });
  it('suma días cruzando meses y años', () => {
    expect(addDays('2024-12-29', 7)).toBe('2025-01-05');
  });
});

describe('dólares', () => {
  it('formatea en USD y convierte a pesos redondeando al centavo', () => {
    expect(money(123456n, 'USD')).toMatch(/US\$\s?1\.234,56/);
    expect(usdToArs(10000n, 123450n)).toBe(12345000n);
    expect(usdToArs(1n, 150n)).toBe(2n);
    expect(usdToArs(-1n, 150n)).toBe(-2n);
  });
});

const rule = (over: Partial<RecurringRule>): RecurringRule => ({
  type: 'expense',
  amount_cents: '1000',
  frequency: 'monthly',
  starts_on: '2024-01-31',
  next_due: '2024-02-29',
  currency: 'ARS',
  description: '',
  category_name: 'Hogar',
  ...over,
});
describe('repeticiones pendientes', () => {
  it('sigue la regla mensual del día 31 como la base de datos', () => {
    const dates = occurrences(rule({}), '2024-05-31').map((o) => o.date);
    expect(dates).toEqual(['2024-02-29', '2024-03-31', '2024-04-30', '2024-05-31']);
  });
  it('suma semanas y excluye las cuentas en dólares', () => {
    const totals = pendingRecurring(
      [
        rule({ frequency: 'weekly', next_due: '2024-02-10', starts_on: '2024-02-03' }),
        rule({ type: 'income', amount_cents: '5000', next_due: '2024-02-20' }),
        rule({ currency: 'USD', next_due: '2024-02-15' }),
      ],
      '2024-02-29',
    );
    expect(totals).toEqual({ income: 5000n, expense: 3000n });
  });
});

describe('qué cambió', () => {
  it('ordena por diferencia absoluta y calcula el porcentaje', () => {
    const changes = categoryChanges(
      [
        ['Salidas', 14000n],
        ['Hogar', 9000n],
        ['Viajes', 3000n],
      ],
      [
        ['Salidas', 10000n],
        ['Hogar', 9000n],
        ['Ropa', 6000n],
      ],
    );
    expect(changes.map((c) => c.name)).toEqual(['Ropa', 'Salidas', 'Viajes']);
    expect(changes[1].percent).toBe(40);
    expect(changes[0].diff).toBe(-6000n);
    expect(changes[2].percent).toBeNull();
  });
});
