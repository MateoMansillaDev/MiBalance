// Preferencias de este dispositivo, guardadas en el navegador. No contienen
// datos financieros.
export const PREFS = {
  theme: 'mb-theme',
  compare: 'mb-compare',
  hideBalances: 'mb-hide-balances',
} as const;
export function readPref(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
