'use client';
import { useSyncExternalStore } from 'react';
import { currentBook, mergeIn, subscribe as onBookChange, useStore } from '@/local/store';
import { latestStamp } from '@/local/merge';
import { parseDoc } from '@/local/schema';
import { readPref, writePref } from '@/lib/preferences';
import { AuthError, accountEmail, download, findFile, upload } from './drive';
import { CLIENT_ID, currentToken, forgetToken, requestToken, revokeToken } from './google';

// Sincronización: bajar el archivo del Drive de la persona, combinarlo con la
// copia local y subir el resultado. Como la combinación es conmutativa e
// idempotente, dos dispositivos que sincronizan en cualquier orden terminan
// con lo mismo.
const PREF = 'mb-sync';
type Saved = { email: string | null; lastSync: number | null };
export type SyncState = {
  available: boolean;
  enabled: boolean;
  email: string | null;
  status: 'idle' | 'syncing' | 'needs-login' | 'error';
  message: string;
  lastSync: number | null;
};
function readSaved(): Saved | null {
  try {
    return JSON.parse(readPref(PREF) ?? 'null');
  } catch {
    return null;
  }
}
let state: SyncState = {
  available: !!CLIENT_ID,
  enabled: false,
  email: null,
  status: 'idle',
  message: '',
  lastSync: null,
};
let initialized = false;
const listeners = new Set<() => void>();
function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}
function save() {
  writePref(PREF, JSON.stringify({ email: state.email, lastSync: state.lastSync }));
}
function init() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  const saved = readSaved();
  if (saved) set({ enabled: true, email: saved.email, lastSync: saved.lastSync, status: 'needs-login' });
  onBookChange(schedule);
}

let fileId: string | null = null;
let syncedStamp = 0;
let running: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Tras un cambio local, sube a Drive unos segundos después (si hay sesión). */
function schedule() {
  if (!state.enabled || running) return;
  let stamp = 0;
  try {
    stamp = latestStamp(currentBook().doc);
  } catch {
    return;
  }
  if (stamp <= syncedStamp) return;
  if (!currentToken()) {
    if (state.status !== 'needs-login') set({ status: 'needs-login', message: '' });
    return;
  }
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void syncNow(false), 4000);
}

async function run(token: string) {
  fileId ??= await findFile(token);
  if (fileId) await mergeIn(parseDoc(await download(token, fileId)));
  const doc = currentBook().doc;
  fileId = await upload(token, fileId, JSON.stringify(doc));
  syncedStamp = latestStamp(doc);
}

/** Sincroniza ahora. Con `interactive` puede abrir la ventana de Google (llamar desde un clic). */
export function syncNow(interactive: boolean) {
  running ??= (async () => {
    set({ status: 'syncing', message: '' });
    try {
      let token = currentToken();
      if (!token) {
        if (!interactive) {
          set({ status: 'needs-login' });
          return;
        }
        token = await requestToken(state.enabled ? '' : 'consent', state.email ?? undefined);
      }
      try {
        await run(token);
      } catch (error) {
        if (!(error instanceof AuthError) || !interactive) throw error;
        forgetToken();
        await run(await requestToken('', state.email ?? undefined));
      }
      const email = state.email ?? (await accountEmail(currentToken()!));
      set({ enabled: true, email, status: 'idle', lastSync: Date.now(), message: '' });
      save();
    } catch (error) {
      if (error instanceof AuthError) {
        forgetToken();
        set({ status: 'needs-login', message: 'Volvé a conectar tu cuenta de Google.' });
      } else
        set({
          status: 'error',
          message: error instanceof Error ? error.message : 'No se pudo sincronizar con Google Drive.',
        });
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Deja de sincronizar en este dispositivo. Los datos siguen acá y en Drive. */
export async function disconnect() {
  await revokeToken();
  fileId = null;
  syncedStamp = 0;
  writePref(PREF, '');
  try {
    localStorage.removeItem(PREF);
  } catch {}
  set({ enabled: false, email: null, status: 'idle', message: '', lastSync: null });
}

function subscribe(listener: () => void) {
  init();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function useSync() {
  useStore();
  return useSyncExternalStore(subscribe, () => state, () => state);
}
