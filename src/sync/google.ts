'use client';
// Inicio de sesión con Google en el navegador (Google Identity Services). Se
// pide un token de acceso de corta duración con un solo permiso: la carpeta de
// datos de MiBalance en el Drive de la persona. El token vive en memoria.
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
export const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};
type TokenClient = { requestAccessToken: (o?: { prompt?: string; hint?: string }) => void };
type Gis = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (r: TokenResponse) => void;
        error_callback?: (e: { type?: string; message?: string }) => void;
      }) => TokenClient;
      hasGrantedAllScopes: (r: TokenResponse, scope: string) => boolean;
      revoke: (token: string, done?: () => void) => void;
    };
  };
};
declare global {
  interface Window {
    google?: Gis;
  }
}

let loading: Promise<Gis> | null = null;
function loadGis() {
  loading ??= new Promise<Gis>((resolve, reject) => {
    if (window.google?.accounts) return resolve(window.google);
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () =>
      window.google?.accounts ? resolve(window.google) : reject(new Error('gis'));
    script.onerror = () => {
      loading = null;
      reject(new Error('No se pudo cargar el inicio de sesión de Google. Revisá la conexión.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

let token: { value: string; expires: number } | null = null;
export function currentToken() {
  return token && token.expires > Date.now() + 60_000 ? token.value : null;
}
export function forgetToken() {
  token = null;
}
/** Pide un token. Con `consent` muestra la pantalla de permisos de Google; debe llamarse desde un clic. */
export async function requestToken(prompt: '' | 'consent', hint?: string): Promise<string> {
  if (!CLIENT_ID) throw new Error('Falta configurar el ID de cliente de Google.');
  const gis = await loadGis();
  return new Promise<string>((resolve, reject) => {
    const client = gis.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (r) => {
        if (r.error || !r.access_token)
          return reject(new Error('Google no autorizó el acceso a Drive.'));
        if (!gis.accounts.oauth2.hasGrantedAllScopes(r, DRIVE_SCOPE))
          return reject(new Error('Para sincronizar, permití que MiBalance guarde sus datos en tu Drive.'));
        token = { value: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000 };
        resolve(r.access_token);
      },
      error_callback: (e) =>
        reject(
          new Error(
            e.type === 'popup_closed'
              ? 'Cerraste la ventana de Google antes de terminar.'
              : 'No se pudo abrir la ventana de Google. Permití las ventanas emergentes para este sitio.',
          ),
        ),
    });
    client.requestAccessToken({ prompt, hint });
  });
}
export async function revokeToken() {
  const value = token?.value;
  token = null;
  if (!value) return;
  const gis = await loadGis().catch(() => null);
  gis?.accounts.oauth2.revoke(value);
}
