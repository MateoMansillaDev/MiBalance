import { PIN_COOKIE } from './preferences';

// Pantalla de privacidad local: el PIN nunca sale del navegador ni se guarda
// en claro, solo su derivación PBKDF2. No reemplaza la contraseña de la cuenta.
const STORE = 'mb-pin';
export const UNLOCKED = 'mb-unlocked';
type Stored = { salt: string; hash: string };

export const validPin = (pin: string) => /^\d{4,8}$/.test(pin);

function toBase64(bytes: ArrayBuffer | Uint8Array) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
async function derive(pin: string, salt: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: Uint8Array.from(atob(salt), (c) => c.charCodeAt(0)),
      iterations: 210000,
    },
    key,
    256,
  );
  return toBase64(bits);
}
export function readPin(): Stored | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORE) ?? 'null');
    return value && typeof value.salt === 'string' && typeof value.hash === 'string'
      ? value
      : null;
  } catch {
    return null;
  }
}
function setCookie(on: boolean) {
  document.cookie =
    PIN_COOKIE + '=' + (on ? '1' : '0') + '; path=/; max-age=31536000; samesite=lax';
}
export function markUnlocked() {
  try {
    sessionStorage.setItem(UNLOCKED, '1');
  } catch {}
}
export function isUnlocked() {
  try {
    return sessionStorage.getItem(UNLOCKED) === '1';
  } catch {
    return false;
  }
}
export function lockNow() {
  try {
    sessionStorage.removeItem(UNLOCKED);
  } catch {}
}
export async function savePin(pin: string) {
  const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
  localStorage.setItem(STORE, JSON.stringify({ salt, hash: await derive(pin, salt) }));
  setCookie(true);
  markUnlocked();
}
export async function checkPin(pin: string) {
  const stored = readPin();
  if (!stored || !validPin(pin)) return false;
  return (await derive(pin, stored.salt)) === stored.hash;
}
export function clearPin() {
  try {
    localStorage.removeItem(STORE);
    sessionStorage.removeItem(UNLOCKED);
  } catch {}
  setCookie(false);
}
export function syncCookie(on: boolean) {
  setCookie(on);
}
