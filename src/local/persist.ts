import { emptyDoc, parseDoc, type Doc } from './schema';

// Guardado en el dispositivo con IndexedDB. La conexión se abre una vez y cada
// guardado crea su transacción en el mismo instante del cambio: así una recarga
// o un cierre inmediato no se lleva el último cambio. El documento entero se
// escribe en una sola transacción, completa o no.
const DB = 'mibalance';
const STORE = 'book';
let connection: Promise<IDBDatabase> | null = null;
export function openDb(): Promise<IDBDatabase> {
  connection ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      connection = null;
      reject(req.error);
    };
  });
  return connection;
}
/** Escribe en una transacción creada ya mismo; las escrituras se aplican en orden. */
export function write(db: IDBDatabase, key: string, value: string) {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
function read(db: IDBDatabase, key: string) {
  return new Promise<string | undefined>((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function loadDoc(db: IDBDatabase): Promise<Doc> {
  const text = await read(db, 'doc');
  return text ? parseDoc(text) : emptyDoc();
}
export function saveDoc(db: IDBDatabase, text: string) {
  return write(db, 'doc', text);
}

// Bitácora sincrónica: IndexedDB es asíncrono y el navegador cancela las
// escrituras sin terminar al recargar o cerrar la página. Cada cambio se anota
// primero en localStorage, que se escribe en el acto, y se borra cuando
// IndexedDB confirma. Al abrir, una bitácora pendiente se combina con lo guardado.
const JOURNAL = 'mb-journal';
export function journal(text: string) {
  try {
    localStorage.setItem(JOURNAL, text);
  } catch {
    // Sin espacio en localStorage: queda solo IndexedDB.
  }
}
export function clearJournal(text: string) {
  try {
    if (localStorage.getItem(JOURNAL) === text) localStorage.removeItem(JOURNAL);
  } catch {}
}
export function pendingJournal(): Doc | null {
  try {
    const text = localStorage.getItem(JOURNAL);
    return text ? parseDoc(text) : null;
  } catch {
    return null;
  }
}
export async function deviceId(db: IDBDatabase) {
  let id = await read(db, 'device');
  if (!id) {
    id = crypto.randomUUID();
    await write(db, 'device', id);
  }
  return id;
}
