const limit = 9223372036854775807n;
const formatters = {
  ARS: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }),
  USD: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }),
};

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

export function money(cents: string | bigint, currency: 'ARS' | 'USD' = 'ARS') {
  const [whole, fraction] = decimal(cents).split(',');
  const integer = whole === '-0' ? -0 : BigInt(whole);
  return formatters[currency]
    .formatToParts(integer)
    .map((part) => (part.type === 'fraction' ? fraction : part.value))
    .join('');
}

export function percent(value: bigint, max: bigint) {
  return max > 0n ? Number((value * 10000n) / max) / 100 : 0;
}

/** Reparte un total en cuotas exactas: el resto de centavos va a las primeras. */
export function splitInstallments(total: bigint, count: number) {
  if (!Number.isInteger(count) || count < 2 || count > 60)
    throw new Error('Elegí entre 2 y 60 cuotas.');
  const n = BigInt(count);
  if (total < n) throw new Error('El importe no alcanza para esa cantidad de cuotas.');
  const base = total / n;
  const rest = total % n;
  return Array.from({ length: count }, (_, i) => base + (BigInt(i) < rest ? 1n : 0n));
}

/** Convierte centavos de dólar a centavos de peso, redondeando al centavo más cercano. */
export function usdToArs(usdCents: bigint, arsCentsPerUsd: bigint) {
  const product = usdCents * arsCentsPerUsd;
  const sign = product < 0n ? -1n : 1n;
  const abs = product < 0n ? -product : product;
  return sign * ((abs + 50n) / 100n);
}
