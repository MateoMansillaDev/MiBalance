// Sin conexión: la app es estática y sus datos viven en el dispositivo, así que
// se guardan copias de las páginas y los recursos ya visitados. Las páginas se
// piden primero a la red (para recibir actualizaciones) y los recursos con
// nombre versionado se sirven desde la caché.
const CACHE = 'mibalance-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            if (res.ok) caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }
  event.respondWith(fromNetwork(request));
});

async function fromNetwork(request) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, res.clone());
    }
    return res;
  } catch {
    const hit = await caches.match(request);
    if (hit) return hit;
    if (request.mode === 'navigate') {
      const home = await caches.match('/resumen/');
      if (home) return home;
    }
    return new Response(
      '<!doctype html><html lang="es-AR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MiBalance sin conexión</title><main><h1>Necesitás conexión</h1><p>Abrí MiBalance una vez con conexión para usarlo sin internet.</p><a href="/">Reintentar</a></main></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}
