# MiBalance

Aplicación personal para registrar ingresos y gastos en pesos argentinos. La Fase 1 incluye registro e inicio de sesión por correo, resumen mensual, gráficos semanales y por categoría, cuentas con saldo inicial, categorías editables e historial con filtros y paginación.

## Fase 3 · Transferencias, metas y comparación

- En **Cuentas → Transferencias** elegí el origen, el destino, la fecha y el importe. El débito y el crédito provienen de una sola fila de PostgreSQL. Un reintento conserva el identificador de la operación. El historial permite eliminar una transferencia con confirmación y revierte ambos efectos juntos. Se admiten saldos negativos, igual que al registrar gastos.
- En **Planificación → Metas de ahorro** asigná un objetivo en ARS a una cuenta. Podés cambiar su nombre e importe o quitar la meta. Una cuenta admite una sola meta simultánea. El avance usa su saldo completo y se actualiza con ingresos, gastos y transferencias.
- En **Resumen** elegí el mes y comparalo con otro. La tabla muestra ingresos, gastos, neto y la diferencia en pesos. El mes anterior es la referencia inicial. En **Configuración** podés ocultar la comparativa y elegir el tema. Las preferencias se guardan en el navegador.
- Podés instalar MiBalance desde un navegador compatible usando HTTPS o el servidor de producción en localhost. Las consultas y escrituras financieras requieren conexión. El service worker muestra una página pública al fallar una navegación y no almacena respuestas ni encola operaciones. [PWA con Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps)

## Fase 2 · Control y planificación

**Planificación** reúne los presupuestos y los movimientos recurrentes. En una instalación local existente, iniciá Docker, ejecutá `npm run db:start` y luego `npx supabase migration up --local` antes de abrir la versión nueva.

- **Presupuestos.** Elegí el mes, la categoría de gasto y el límite en ARS. Volver a guardar esa combinación actualiza el límite. La pantalla muestra el gasto registrado, el disponible o el exceso. Al llegar al 80 %, al alcanzar el límite y al superarlo, el resumen del mismo mes muestra un aviso dentro de la aplicación.
- **Repeticiones.** Programá un ingreso o gasto semanal o mensual desde una fecha de calendario. Al acceder al área privada se registran los vencimientos pendientes hasta el día actual en Córdoba. Una regla mensual del día 31 usa el último día de un mes corto y recupera el día 31 cuando corresponde. PostgreSQL bloquea la regla y avanza su próxima fecha en la misma transacción que las altas. Podés finalizarla y conservar su historial. Con la app cerrada, los vencimientos quedan pendientes hasta el siguiente acceso.
- **Reportes.** En Movimientos, el reporte muestra ingresos, gastos y neto para todas las filas que cumplen los filtros, incluso cuando abarcan varias páginas. Podés guardar la búsqueda, las fechas, el tipo, la cuenta, la categoría y el orden con un nombre. Al abrir ese filtro se vuelve a la primera página.
- **CSV.** Exportá el resultado filtrado desde Movimientos. Si excede 300 registros, elegí el lote. Para importar, descargá la plantilla, completala y revisá la vista previa antes de confirmar. Se acepta UTF-8, hasta 300 registros y 850 kB por archivo. Un error de validación cancela el lote completo.

El encabezado del CSV es `id;fecha;tipo;importe;cuenta;categoria;descripcion`. Usá fechas `AAAA-MM-DD`, tipos `ingreso` o `gasto`, importes en pesos y nombres de cuentas y categorías existentes. Los nombres pueden llevar punto y coma o comillas si se escapan según el formato CSV. La exportación protege las celdas de texto que una planilla podría interpretar como fórmulas.

Con ID, la importación reconoce un movimiento propio exportado o una referencia previamente importada. Para filas sin ID compara fecha, tipo, centavos, cuenta, categoría y descripción. Dos operaciones legítimas con valores idénticos pueden distinguirse con UUID diferentes. Las importaciones simultáneas de un mismo usuario se serializan y el resultado final informa cuántas filas se agregaron y cuántas se omitieron.

## Inicio local con Supabase

Necesitás Node.js 24 LTS, npm y Docker Desktop con el motor Linux iniciado. Ejecutá en la raíz del proyecto:

```powershell
npm ci
npm run db:start
npm run db:env
npm run dev
```

Abrí [MiBalance local](http://127.0.0.1:3000) y elegí **Creá tu cuenta**. La primera vez, Docker descarga las imágenes y Supabase aplica la migración automáticamente en el volumen nuevo. El inicio reducido levanta los servicios que usa el MVP. La API escucha en el puerto 55321 y PostgreSQL en el 55322. La configuración local permite registrarse sin confirmar el correo para que puedas probar sin un servidor SMTP.

El script `db:env` crea `.env.local` con la URL y la clave **publicable** que devuelve tu instancia. Si el archivo existe, conserva sus valores. Después de cambiar variables, reiniciá Next.js. Para detener la app usá Ctrl+C. Para detener los contenedores conservando la base local, usá `npx supabase stop`. Para aplicar migraciones nuevas a una instancia existente, usá `npx supabase migration up` con la CLI del proyecto.

## Conectar un proyecto Supabase propio

1. Copiá `.env.example` a `.env.local`. Cargá la URL del proyecto en `NEXT_PUBLIC_SUPABASE_URL` y su clave publicable en `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Las dos deben pertenecer a la misma instancia.
2. Aplicá las migraciones versionadas de `supabase/migrations/` en orden, después de revisar el destino. La app espera el esquema en `public` y acceso mediante Data API.
3. Habilitá el proveedor Email/Password y mantené deshabilitados los inicios anónimos. Para solicitar confirmación por correo, configurá una Site URL de confianza en Auth y usá este enlace en la plantilla **Confirm signup**:

   ```html
   <a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}">Confirmar mi cuenta</a>
   ```

4. Ejecutá `npm run dev`. En el primer acceso se crean **Efectivo** y seis categorías editables. Un marcador por usuario, escrito en la misma transacción, evita duplicados y conserva los cambios que hagas a esas sugerencias. Cada cuenta empieza sin movimientos.

Si faltan las variables, la pantalla de acceso explica qué configurar. Las operaciones protegidas requieren una identidad verificada en el servidor. Mantené las claves secretas, los datos personales y los respaldos fuera del repositorio. [Autenticación SSR de Supabase](https://supabase.com/docs/guides/auth/server-side/creating-a-client) · [Plantillas de correo](https://supabase.com/docs/guides/auth/auth-email-templates)

## Cómo se calculan los saldos

- **Saldo neto del mes** = ingresos del mes menos gastos del mes. **Saldo disponible de una cuenta** = saldo inicial + ingresos − gastos + transferencias recibidas − transferencias enviadas. La cuenta admite un saldo inicial negativo.
- Los movimientos guardan importes positivos en centavos `BIGINT`. La API intercambia los importes como texto y la aplicación suma con `bigint`. PostgreSQL usa una suma de precisión ampliada para que el total pueda superar el límite de una fila individual.
- `1.234,56`, `1234,56` y `1234.56` representan 123456 centavos. `1.234` representa mil doscientos treinta y cuatro pesos. Se rechazan movimientos de cero, negativos, decimales excedentes y notación exponencial.
- Las fechas son de calendario (`DATE`). El día actual se calcula en `America/Argentina/Cordoba`. Desde y hasta son inclusivos. El resumen y su enlace al historial usan el mismo mes. Las semanas del gráfico agrupan los días 1–7, 8–14, 15–21, 22–28 y los restantes.
- El historial permite buscar por descripción, filtrar por fechas, tipo, cuenta y categoría y alternar el orden. Devuelve 20 filas por página. El resumen mensual se agrega en la base sobre todos los movimientos del período.
- El borrado de movimientos requiere confirmación. Las claves foráneas bloquean la eliminación de cuentas y categorías en uso, así como el cambio de tipo de una categoría con movimientos. Renombrar un registro conserva sus relaciones.

## Arquitectura y aislamiento

| Ruta | Responsabilidad |
| --- | --- |
| `src/app/` | Rutas de App Router, acceso, confirmación por correo y área privada. |
| `src/features/auth/` | Formularios y acciones de autenticación. |
| `src/features/ledger/` | Formularios, lecturas, filtros y acciones de cuentas, categorías y movimientos. |
| `src/lib/` | Validación Zod, importes exactos, fechas, resumen y sesión Supabase SSR. |
| `src/components/` y `src/styles/` | Navegación, componentes, SCSS Modules y tokens para ambos temas. |
| `supabase/migrations/` | Tablas, índices, RLS, vistas y funciones de agregación. |
| `tests/` | Pruebas unitarias, de integración con dos usuarios y de navegador. |

Las acciones obtienen el usuario con `auth.getUser()` en el servidor. Las políticas de las tablas financieras limitan lectura, alta, modificación y borrado por `auth.uid()`. Una actualización valida tanto la fila original como su nueva propiedad. Las claves compuestas imponen el usuario de las cuentas y categorías y el tipo del movimiento. Las vistas y funciones financieras se ejecutan con los permisos de quien consulta. [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Pruebas y compilación

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:db
npm run test:backup
npx playwright install chromium
npm run test:e2e
```

`test:db` y `test:e2e` requieren la instancia **local de MiBalance** iniciada con `npm run db:start`. Las pruebas obtienen de la CLI sus credenciales locales, crean identidades descartables y las eliminan al terminar. Los accesos a las tablas se prueban con sesiones normales. La credencial administrativa queda en el proceso de pruebas. Se usa para generar un enlace de confirmación local, revocar la identidad de prueba y limpiar sus usuarios.

Playwright prueba la compilación de producción en un servidor propio en el puerto 3187, en escritorio y en viewport móvil. Ejecutá el build antes de las E2E. Los scripts de desarrollo y compilación usan Webpack para procesar SCSS Modules de forma consistente en Windows. Para servir la compilación manualmente, ejecutá `npm start -- --hostname 127.0.0.1`.

La entrega y verificación corresponden a la instalación local. En un proyecto alojado con confirmación habilitada, verificá la entrega de correo, el enlace de confirmación y las URL de Auth con el dominio elegido.

## Despliegue

Podés ejecutar la app en un servidor Node.js con HTTPS delante del proceso o en un proveedor compatible con Next.js, como Vercel. Configurá las dos variables de `.env.example` antes del build, aplicá las migraciones al proyecto elegido y configurá el dominio público en Supabase Auth y en la plantilla de confirmación. Usá `npm ci` y `npm run build`. En un servidor propio, iniciá el proceso con `npm start`. [Despliegue de Next.js](https://nextjs.org/docs/app/getting-started/deploying)

Para verificar el destino, abrí `/manifest.webmanifest` y comprobá que los dos íconos cargan. Abrí `/cuentas` sin sesión, ingresá con un usuario de prueba y verificá que una transferencia entre dos cuentas modifica sus saldos y conserva el neto del mes. Probá el enlace real del correo con el dominio definitivo. La suite de Playwright ejecuta la compilación de producción contra Supabase local.

## Respaldo y recuperación

El respaldo financiero contiene **todos los usuarios del esquema público**, incluidas sus cuentas, categorías, movimientos, reglas, presupuestos, filtros, metas y transferencias. La recuperación requiere las migraciones de la misma versión, tablas de aplicación vacías y las identidades originales de Auth con sus mismos UUID. Para recuperar también las identidades y la configuración del proyecto, seguí el procedimiento de Supabase. [Respaldo y restauración de Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

Con las herramientas de PostgreSQL de una versión compatible y perfiles de conexión privados `mibalance_origen` y `mibalance_recuperacion`, ejecutá desde un directorio protegido fuera del repositorio. Asigná al segundo perfil una instancia nueva, separada del origen. Conservá el archivo cifrado y restringí su acceso. [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) · [pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html)

```powershell
pg_dump --dbname="service=mibalance_origen" --format=custom --data-only --schema=public --file=mibalance.dump
pg_restore --list mibalance.dump
pg_restore --dbname="service=mibalance_recuperacion" --data-only --single-transaction --exit-on-error mibalance.dump
```

`npm run test:backup` ensaya este procedimiento en el contenedor local. Crea dos bases temporales, aplica las migraciones, carga datos sintéticos, restaura el archivo en la segunda y compara todas las filas públicas y los saldos, incluso importes superiores al límite exacto de JavaScript. Al terminar elimina las bases que creó.

## Estado de dependencias

El 18 de noviembre de 2026, la auditoría de dependencias de ejecución (`npm audit --omit=dev`) informó cero avisos en el lockfile de la Fase 2.
