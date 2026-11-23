import { collections, emptyDoc, type Collections, type Doc } from './schema';

type Stamped = { updated_at: number; device: string };
/** Ordena dos versiones del mismo registro: la de sello mayor gana. */
export function newer(a: Stamped, b: Stamped) {
  return a.updated_at !== b.updated_at
    ? a.updated_at > b.updated_at
    : a.device > b.device;
}

/**
 * Combina dos copias registro por registro. Es conmutativa, asociativa e
 * idempotente: no importa el orden en que los dispositivos sincronicen, todos
 * terminan con el mismo contenido.
 */
export function merge(a: Doc, b: Doc): Doc {
  const out = emptyDoc();
  for (const c of collections) {
    const target = out.collections[c] as Record<string, Stamped>;
    for (const source of [a.collections[c], b.collections[c]] as Record<string, Stamped>[])
      for (const [key, rec] of Object.entries(source)) {
        const current = target[key];
        if (!current || newer(rec, current)) target[key] = rec;
      }
  }
  return out;
}

export function latestStamp(doc: Doc) {
  let max = 0;
  for (const c of collections)
    for (const rec of Object.values(doc.collections[c] as Collections[typeof c]))
      max = Math.max(max, (rec as Stamped).updated_at);
  return max;
}
