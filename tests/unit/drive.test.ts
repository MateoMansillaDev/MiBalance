import { describe, it, expect } from 'vitest';
import { AuthError, download, findFile, upload } from '../../src/sync/drive';

type Call = { url: string; init: RequestInit };
function fakeFetch(responses: Response[]) {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return responses.shift()!;
  }) as typeof fetch;
  return calls;
}

describe('archivo de MiBalance en Drive', () => {
  it('busca solo en la carpeta de datos de la app y crea el archivo dentro de ella', async () => {
    const calls = fakeFetch([
      new Response(JSON.stringify({ files: [] })),
      new Response(JSON.stringify({ id: 'f1' })),
    ]);
    expect(await findFile('t')).toBeNull();
    expect(calls[0].url).toMatch(/spaces=appDataFolder/);
    expect(await upload('t', null, '{"a":1}')).toBe('f1');
    const body = String(calls[1].init.body);
    expect(body.includes('"parents":["appDataFolder"]')).toBe(true);
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe('Bearer t');
  });
  it('actualiza el archivo existente y lo descarga', async () => {
    const calls = fakeFetch([new Response('{}'), new Response('{"x":1}')]);
    expect(await upload('t', 'f1', '{}')).toBe('f1');
    expect(calls[0].init.method).toBe('PATCH');
    expect(await download('t', 'f1')).toBe('{"x":1}');
  });
  it('distingue una sesión vencida de otros errores', async () => {
    fakeFetch([new Response('', { status: 401 })]);
    await findFile('t').then(
      () => expect(true).toBe(false),
      (e) => expect(e instanceof AuthError).toBe(true),
    );
    fakeFetch([new Response('', { status: 500 })]);
    await findFile('t').then(
      () => expect(true).toBe(false),
      (e) => expect(e instanceof AuthError).toBe(false),
    );
  });
});
