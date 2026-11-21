import { describe, it, expect } from 'vitest';
import { decimal, money, parseCents } from '../../src/lib/money';
import { period, today, validDate } from '../../src/lib/dates';
import { summarize } from '../../src/lib/summary';

describe('centavos en ARS', () => {
  it.each([
    ['1.234,56', 123456n],
    ['1234,56', 123456n],
    ['1234.56', 123456n],
    ['1.234', 123400n],
    ['0,01', 1n],
    ['92233720368547758,07', 9223372036854775807n],
  ])('%s', (text, expected) => {
    expect(parseCents(String(text))).toBe(expected);
  });
  it.each([
    '0',
    '-1',
    '1,234',
    '1..000',
    '1e3',
    '',
    'NaN',
    '92233720368547758,08',
  ])('rechaza %s', (text) => {
    expect(() => parseCents(text)).toThrow();
  });
  it('conserva centavos y signo incluso por encima del rango seguro de Number', () => {
    const max = 9223372036854775807n;
    expect(decimal(max)).toBe('92233720368547758,07');
    expect(money(max)).toMatch(/92\.233\.720\.368\.547\.758,07/);
    expect(money(-1n)).toMatch(/-.*0,01/);
    expect(parseCents('-0,01', true)).toBe(-1n);
    expect(parseCents('0', true)).toBe(0n);
  });
});
describe('fechas calendario', () => {
  it('cambia de día a medianoche de Córdoba', () => {
    expect(today(new Date('2026-03-01T02:59:59Z'))).toBe('2026-02-28');
    expect(today(new Date('2026-03-01T03:00:00Z'))).toBe('2026-03-01');
  });
  it('incluye ambos extremos incluso en febrero bisiesto', () => {
    expect(period('2024-02')).toEqual({
      start: '2024-02-01',
      end: '2024-02-29',
    });
    expect(validDate('2025-02-29')).toBe(false);
    expect(validDate('2024-13-01')).toBe(false);
  });
});
it('reconcilia semanas, categorías y neto con enteros', () => {
  const s = summarize([
    {
      week: 1,
      type: 'income',
      category_name: 'Ingreso',
      cents: '9007199254740993',
    },
    { week: 2, type: 'expense', category_name: 'Hogar', cents: '99' },
    { week: 3, type: 'expense', category_name: 'Hogar', cents: '1' },
  ]);
  expect(s.net).toBe(9007199254740893n);
  expect(s.categories).toEqual([['Hogar', 100n, null]]);
  expect(s.weeks.reduce((a, w) => a + w.expense, 0n)).toBe(s.expense);
});
