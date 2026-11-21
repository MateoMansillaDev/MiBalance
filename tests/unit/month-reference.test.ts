import { expect, it } from 'vitest';
import { previousMonth } from '../../src/lib/dates';
it('elige el mes anterior incluso al cruzar de año y respeta el límite del calendario', () => {
  expect(previousMonth('2024-03')).toBe('2024-02');
  expect(previousMonth('2024-01')).toBe('2023-12');
  expect(previousMonth('1000-01')).toBeNull();
});
