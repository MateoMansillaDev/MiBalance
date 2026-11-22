import { emptyDoc, parseDoc, type Doc } from './schema';

// Guardado en el dispositivo con IndexedDB. El documento entero se escribe en
// una sola transacción, así una operación queda completa o no queda.
const DB = 'mibalance';
const STORE = 'book';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}
export async function loadDoc(): Promise<Doc> {
  const text = await run<string | undefined>('readonly', (s) => s.get('doc'));
  return text ? parseDoc(text) : emptyDoc();
}
export function saveDoc(doc: Doc) {
  return run('readwrite', (s) => s.put(JSON.stringify(doc), 'doc'));
}
export async function deviceId() {
  let id = await run<string | undefined>('readonly', (s) => s.get('device'));
  if (!id) {
    id = crypto.randomUUID();
    await run('readwrite', (s) => s.put(id, 'device'));
  }
  return id;
}
