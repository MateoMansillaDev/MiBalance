export function budgetStatus(spent: bigint, limit: bigint) {
  if (spent > limit) return 'Límite superado';
  if (spent === limit) return 'Límite alcanzado';
  return spent * 5n >= limit * 4n ? 'Alcanzaste el 80 %' : 'Dentro del presupuesto';
}
