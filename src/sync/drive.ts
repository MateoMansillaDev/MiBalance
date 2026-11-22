// Archivo de MiBalance en la carpeta de datos de la app (appDataFolder) del
// Drive de cada persona. MiBalance no puede ver ningún otro archivo.
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const FILE_NAME = 'mibalance.json';
const MAX_BYTES = 50 * 1024 * 1024;

export class AuthError extends Error {}
async function call(token: string, url: string, init: RequestInit = {}) {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: 'Bearer ' + token },
    });
  } catch {
    throw new Error('Sin conexión con Google Drive. Se va a reintentar más tarde.');
  }
  if (res.status === 401) throw new AuthError('Tu sesión de Google venció.');
  if (!res.ok) throw new Error('Google Drive respondió con un error (' + res.status + ').');
  return res;
}
export async function findFile(token: string) {
  const q = encodeURIComponent("name = '" + FILE_NAME + "' and trashed = false");
  const res = await call(
    token,
    API + '/files?spaces=appDataFolder&q=' + q + '&fields=files(id,modifiedTime)&orderBy=modifiedTime desc',
  );
  const body = (await res.json()) as { files?: { id: string }[] };
  return body.files?.[0]?.id ?? null;
}
export async function download(token: string, id: string) {
  const res = await call(token, API + '/files/' + encodeURIComponent(id) + '?alt=media');
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error('El archivo de Drive es demasiado grande.');
  return text;
}
export async function upload(token: string, id: string | null, text: string) {
  if (id) {
    await call(token, UPLOAD + '/files/' + encodeURIComponent(id) + '?uploadType=media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: text,
    });
    return id;
  }
  const boundary = 'mibalance' + crypto.randomUUID();
  const body =
    '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] }) +
    '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' +
    text + '\r\n--' + boundary + '--';
  const res = await call(token, UPLOAD + '/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
    body,
  });
  return ((await res.json()) as { id: string }).id;
}
export async function accountEmail(token: string) {
  try {
    const res = await call(token, API + '/about?fields=user(emailAddress)');
    return ((await res.json()) as { user?: { emailAddress?: string } }).user?.emailAddress ?? null;
  } catch {
    return null;
  }
}
