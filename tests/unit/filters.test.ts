import { expect, it } from 'vitest';
import { historyFilters } from '@/features/ledger/filters';

it('rechaza rangos invertidos, fechas inexistentes e identificadores inválidos', () => {
  expect(historyFilters({ desde: '2024-03-01', hasta: '2024-02-29' }).invalid).toBe(true);
  expect(historyFilters({ hasta: '2024-02-30' }).invalid).toBe(true);
  expect(historyFilters({ cuenta: 'invalida' }).invalid).toBe(true);
  expect(historyFilters({ desde: '2024-02-29', hasta: '2024-02-29' }).invalid).toBe(false);
});
