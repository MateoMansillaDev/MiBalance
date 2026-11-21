// Solo las navegaciones usan esta respuesta pública cuando la red falla.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate' || event.request.method !== 'GET')
    return;
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(
          '<!doctype html><html lang="es-AR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MiBalance sin conexión</title><main><h1>Necesitás conexión</h1><p>Volvé a conectarte para consultar MiBalance.</p><a href="/">Reintentar</a></main></html>',
          {
            status: 503,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          },
        ),
    ),
  );
});
