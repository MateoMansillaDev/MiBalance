# MiBalance

Aplicación personal para registrar ingresos y gastos en pesos argentinos (y cuentas en dólares). Funciona **en el dispositivo**: tus datos se guardan en el navegador o en la app, sin cuenta ni servidor, y la app sigue andando sin conexión. Opcionalmente, cada persona puede sincronizar sus datos con su propio Google Drive. La app Android llega en la etapa 4 de la fase 5.

## Inicio local

Necesitás Node.js 24 LTS y npm. En la raíz del proyecto:

```powershell
npm ci
npm run dev
```

Abrí [MiBalance local](http://127.0.0.1:3000). En el primer uso se crean **Efectivo** y seis categorías editables, una sola vez por dispositivo. No hace falta registrarse. Para probar la sincronización, cargá el ID de cliente de Google en `.env.local` (ver más abajo).

Si venías de una versión con Supabase, quitá esas dependencias una vez con `npm uninstall @supabase/ssr @supabase/supabase-js supabase` (actualiza el `package-lock.json`). Los datos de la base anterior no se trasladan solos: exportalos como CSV desde la versión anterior e importalos acá.

## Dónde viven los datos

- Un solo documento en **IndexedDB** del navegador (o de la app). Cada operación valida todas sus reglas y se guarda completa o no se guarda.
- Las reglas que antes imponía PostgreSQL ahora las aplica `src/local/book.ts`: importes positivos en centavos, categoría del mismo tipo que el movimiento, monedas que no se mezclan, cuotas exactas, cuentas y categorías con historial que no se pueden borrar, cuentas con historial que no cambian de moneda.
- Cada registro lleva su sello de modificación y los borrados quedan como lápidas. Al combinar dos copias (`src/local/merge.ts`) gana la última escritura de cada registro; la combinación da el mismo resultado sin importar el orden. Las sugerencias iniciales, los vencimientos recurrentes y las cuotas usan identificadores estables, así dos dispositivos sin conexión no los duplican.
- En **Configuración → Tus datos** podés descargar un respaldo JSON y restaurarlo: se combina con lo que ya hay. Todo archivo leído se valida antes de usarse.
- Las preferencias (tema, comparativa, saldos ocultos, PIN) son de cada dispositivo.

## Sincronización con Google Drive

En **Configuración → Sincronización con Google Drive**, cada persona conecta **su propia cuenta de Google**. MiBalance guarda un archivo `mibalance.json` en la carpeta privada de la app dentro del Drive de esa persona, con el permiso `drive.appdata`: la app solo ve esa carpeta, nunca los demás archivos. No hay servidor intermedio: el navegador habla directo con Drive y el token de acceso vive en memoria.

- Al sincronizar se baja el archivo, se valida, se combina con la copia local (gana el cambio más reciente de cada registro) y se sube el resultado. Después de cada cambio se sincroniza solo, unos segundos más tarde, mientras la sesión de Google siga activa.
- En la web, Google entrega tokens de corta duración: al volver a abrir la app, el botón **Sincronizar con Drive** de la barra superior pide la sesión de nuevo con un clic.
- **Desconectar** deja de sincronizar en ese dispositivo; los datos siguen en el dispositivo y en Drive.
- El uso de la API de Drive no tiene costo. Para configurarla hace falta un proyecto de Google Cloud con la API de Drive habilitada, la app registrada en Google Auth Platform (público externo, permiso `drive.appdata`) y un ID de cliente de tipo *Aplicación web* con los orígenes desde donde se sirve MiBalance (`http://127.0.0.1:3000` y `http://localhost:3000` para desarrollo, y el dominio con HTTPS al publicar). El ID va en `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (ver `.env.example`); es público, no un secreto. Mientras la app esté en modo prueba, solo pueden conectarse las cuentas cargadas como usuarios de prueba.

## Funciones

- **Resumen**: dinero en tus cuentas (pesos, dólares estimados y deuda de tarjetas, con botón para ocultar importes), saldo neto, ingresos y gastos del mes, proyección de fin de mes, próximos 7 días, gráficos semanales y por categoría, tendencia de seis meses, qué cambió y comparativa con otro mes.
- **Movimientos**: búsqueda, filtros por fecha, tipo, cuenta y categoría, orden y páginas de 20. El reporte suma todas las filas filtradas. Filtros guardados con nombre.
- **CSV**: la exportación se arma en el navegador con el resultado filtrado (en lotes de 300). Para importar, descargá la plantilla y revisá la vista previa antes de confirmar: hasta 300 registros y 850 kB, UTF-8. Un error cancela el lote. El encabezado es `id;fecha;tipo;importe;cuenta;categoria;descripcion`, con fechas `AAAA-MM-DD`, tipos `ingreso` o `gasto` e importes en pesos. Se omiten duplicados por ID o por contenido. El CSV es solo de cuentas en pesos. La exportación protege las celdas que una planilla podría interpretar como fórmulas.
- **Cuentas**: efectivo, banco, billetera virtual y tarjeta de crédito, en ARS o USD, con saldo inicial. **Transferencias** entre cuentas de la misma moneda (editables y reversibles). **Compra y venta de dólares** con los dos importes, sin contar como ingreso ni gasto. **Cotización de referencia** que cargás vos para estimar en pesos las cuentas en dólares.
- **Tarjetas**: compras en cuotas que se registran como gasto en cada mes, todas juntas o ninguna; deuda total y cuotas de los próximos seis meses; el pago del resumen es una transferencia del banco a la tarjeta.
- **Categorías** de ingreso y de gasto con color e ícono.
- **Planificación**: presupuestos mensuales por categoría con avisos al 80 %, al límite y al superarlo; movimientos recurrentes semanales o mensuales que se registran al abrir la app (una regla del día 31 usa el último día de los meses cortos); metas de ahorro por cuenta.
- **Configuración**: tema claro, oscuro o según el sistema; comparativa mensual; bloqueo con PIN; respaldo.
- **Bloqueo con PIN**: se pide al abrir MiBalance en una pestaña nueva y tras 5 minutos en segundo plano. Se guarda solo una derivación PBKDF2. Es una pantalla de privacidad local; si lo olvidás, la única salida es borrar los datos del dispositivo (recuperables desde un respaldo o, más adelante, desde Drive).

## Cómo se calculan los saldos

- **Saldo neto del mes** = ingresos del mes − gastos del mes, solo en pesos. **Saldo de una cuenta** = saldo inicial + ingresos − gastos + transferencias recibidas − enviadas + lo recibido − lo entregado en compras y ventas de dólares, en la moneda de la cuenta.
- Los importes se guardan en centavos como texto y se suman con `bigint`. `1.234,56`, `1234,56` y `1234.56` son 123456 centavos; `1.234` son mil doscientos treinta y cuatro pesos. Se rechazan cero, negativos, decimales excedentes y notación exponencial.
- Las fechas son de calendario. El día actual se calcula en `America/Argentina/Cordoba`. Desde y hasta son inclusivos. Las semanas del gráfico agrupan los días 1–7, 8–14, 15–21, 22–28 y los restantes.

## Arquitectura

| Ruta | Responsabilidad |
| --- | --- |
| `src/local/` | Documento local, reglas (`book.ts`), consultas (`views.ts`), combinación (`merge.ts`), IndexedDB, estado y acciones de las pantallas. |
| `src/app/` | Pantallas cliente de App Router, exportadas como sitio estático (`output: 'export'`). |
| `src/features/` | Formularios y componentes por tema: movimientos, cuentas, CSV, planificación, análisis. |
| `src/lib/` | Validación Zod, importes exactos, fechas, cuotas, proyección, íconos y PIN. |
| `src/components/`, `src/styles/` | Navegación, componentes compartidos, SCSS Modules y tokens de ambos temas. |
| `tests/` | Pruebas unitarias (Vitest) y de navegador (Playwright). |

La app se instala como PWA desde un navegador compatible. El service worker guarda las páginas y recursos ya visitados, así que funciona sin conexión después de la primera visita. [PWA con Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps)

## Pruebas y compilación

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` cubre el núcleo local (reglas, cuotas, monedas, repeticiones, combinación entre dispositivos, CSV), importes, fechas y análisis. `npm run build` genera el sitio estático en `out/`; Playwright lo sirve con `tests/static-server.mjs` en el puerto 3187 y prueba los recorridos en escritorio y celular, cada uno con almacenamiento vacío. Para servir la compilación a mano: `npm start`.

## Seguridad

- **Política de contenido en cada página.** Después de `next build`, `scripts/csp.mjs` agrega a cada página de `out/` una política que solo permite el código propio, el inicio de sesión de Google y conexiones con Google (Drive y la cuenta). Los scripts que Next.js incrusta se permiten por su huella exacta, sin `unsafe-inline`. Si alguien lograra colar código, el navegador no lo dejaría mandar datos a otro sitio.
- **Encabezados en Vercel** (`vercel.json`): no se puede mostrar la app dentro de otro sitio (`frame-ancestors 'none'`), `nosniff`, política de referencia, permisos del navegador desactivados (cámara, micrófono, ubicación, pagos), HTTPS obligatorio y `Cross-Origin-Opener-Policy` compatible con la ventana de Google.
- Sin servidor ni base de datos propia: los datos de cada persona están en su dispositivo y en su Drive. El token de Google vive en memoria y solo da acceso a la carpeta de la app.
- Lo que depende de cada persona: proteger sus cuentas de GitHub, Vercel y Google con verificación en dos pasos, y no compartir el usuario de Windows ni el perfil del navegador.

## Publicación en GitHub Pages

`.github/workflows/pages.yml` publica la app en `https://<usuario>.github.io/<repositorio>/` con cada cambio en `main`: instala dependencias, corre lint y pruebas, compila con la subcarpeta del repositorio (`NEXT_PUBLIC_BASE_PATH`) y publica `out/`.

Una sola vez:

1. En GitHub, **Settings → General → Danger Zone → Change visibility → Public**. En el plan gratuito, GitHub Pages solo funciona con repositorios públicos. El código no contiene secretos: el ID de cliente de Google es público y los datos de cada persona están en su dispositivo y en su Drive.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. En el cliente web de Google (Google Auth Platform → Clientes), agregá el origen `https://<usuario>.github.io` (sin la subcarpeta).

GitHub Pages no permite configurar encabezados HTTP, así que ahí rige la política de seguridad incluida en cada página; los encabezados de `vercel.json` se aplican solo si se publica en Vercel.
