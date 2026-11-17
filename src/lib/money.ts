const limit = 9223372036854775807n;
const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
});

export function parseCents(raw: string, opening = false): bigint {
  const value = raw.trim();
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const grouped = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/;
  const plain = /^\d+(?:[.,]\d{1,2})?$/;
  if (value.length > 32 || (!grouped.test(unsigned) && !plain.test(unsigned))) {
    throw new Error('Ingresá un importe válido, por ejemplo 1.234,56.');
  }
  const normalized = grouped.test(unsigned)
    ? unsigned.replaceAll('.', '')
    : unsigned;
  const [whole, fraction = ''] = normalized.split(/[.,]/);
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (!opening && (negative || cents === 0n))
    throw new Error('El importe debe ser mayor que cero.');
  const signed = negative ? -cents : cents;
  if (signed > limit || signed < -limit - 1n)
    throw new Error('El importe supera el límite permitido.');
  return signed;
}

export function decimal(cents: string | bigint) {
  const n = BigInt(cents);
  const abs = n < 0n ? -n : n;
  return (
    (n < 0n ? '-' : '') + abs / 100n + ',' + String(abs % 100n).padStart(2, '0')
  );
}

export function money(cents: string | bigint) {
  const [whole, fraction] = decimal(cents).split(',');
  const integer = whole === '-0' ? -0 : BigInt(whole);
  return ars
    .formatToParts(integer)
    .map((part) => (part.type === 'fraction' ? fraction : part.value))
    .join('');
}

export function percent(value: bigint, max: bigint) {
  return max > 0n ? Number((value * 10000n) / max) / 100 : 0;
}
