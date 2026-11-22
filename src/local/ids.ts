// Identificadores estables: dos dispositivos que generan lo mismo sin conexión
// (las sugerencias iniciales o un vencimiento recurrente) producen el mismo id,
// y al sincronizar se combinan en vez de duplicarse.
function fnv(text: string, seed: bigint) {
  let hash = seed;
  for (const ch of new TextEncoder().encode(text)) {
    hash ^= BigInt(ch);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}
export function stableId(text: string) {
  const hex = fnv(text, 0xcbf29ce484222325n) + fnv(text, 0x84222325cbf29ce4n);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '5' + hex.slice(13, 16),
    '8' + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-');
}
export function newId() {
  return crypto.randomUUID();
}
