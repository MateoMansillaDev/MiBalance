'use client';
import { useSyncExternalStore } from 'react';
import { today } from '@/lib/dates';
import { Book, DomainError } from './book';
import { deviceId, loadDoc, saveDoc } from './persist';
import { merge } from './merge';
import type { Doc } from './schema';

// Estado del libro en el navegador. Cada operación trabaja sobre una copia:
// si falla una regla, el libro visible no cambia; si se cumple, se reemplaza y
// se guarda en IndexedDB en orden.
type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; book: Book; saveError: string };
let state: State = { status: 'loading' };
let device = '';
let started: Promise<void> | null = null;
let queue: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
function emit(next: State) {
  state = next;
  for (const l of listeners) l();
}
function persist(doc: Doc) {
  queue = queue
    .then(() => saveDoc(doc))
    .then(
      () => state.status === 'ready' && state.saveError && emit({ ...state, saveError: '' }),
      () =>
        state.status === 'ready' &&
        emit({ ...state, saveError: 'No se pudieron guardar los cambios en este dispositivo.' }),
    );
  return queue;
}
export function startStore() {
  started ??= (async () => {
    try {
      const [doc, id] = await Promise.all([loadDoc(), deviceId()]);
      device = id;
      const book = new Book(doc, device);
      book.refresh(today());
      emit({ status: 'ready', book, saveError: '' });
      await persist(book.doc);
    } catch {
      emit({
        status: 'error',
        message: 'No se pudieron abrir tus datos en este dispositivo. Revisá que el navegador permita guardar información del sitio.',
      });
    }
  })();
  return started;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function useStore() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
/** El libro listo; solo se usa dentro de las pantallas privadas, que esperan a que cargue. */
export function useBook() {
  const s = useStore();
  if (s.status !== 'ready') throw new Error('El libro todavía no está listo.');
  return s.book;
}
export function currentBook() {
  if (state.status !== 'ready') throw new Error('El libro todavía no está listo.');
  return state.book;
}

export type Outcome = { error: string } | { ok: true };
/** Aplica una operación completa o ninguna. */
export function mutate(fn: (book: Book) => void): Outcome {
  if (state.status !== 'ready') return { error: 'Tus datos todavía se están cargando.' };
  const draft = new Book(structuredClone(state.book.doc), device);
  try {
    fn(draft);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    return { error: 'No pudimos guardar los cambios. Volvé a intentar.' };
  }
  emit({ ...state, book: draft });
  void persist(draft.doc);
  return { ok: true };
}
/** Combina otra copia (de Drive o de un respaldo) con la local. */
export function mergeIn(other: Doc) {
  if (state.status !== 'ready') return;
  const book = new Book(merge(state.book.doc, other), device);
  book.refresh(today());
  emit({ ...state, book });
  return persist(book.doc);
}
/** Borra los datos de este dispositivo (respaldo en Drive o archivo aparte). */
export async function wipeDevice() {
  const { emptyDoc } = await import('./schema');
  const book = new Book(emptyDoc(), device || 'nuevo');
  book.initialize();
  if (state.status === 'ready') emit({ ...state, book });
  await persist(book.doc);
}
