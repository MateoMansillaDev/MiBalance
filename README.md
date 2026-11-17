# MiBalance

Aplicación personal para registrar ingresos y gastos en pesos argentinos. La Fase 1 incluye registro e inicio de sesión por correo, resumen mensual, gráficos semanales y por categoría, cuentas con saldo inicial, categorías editables e historial con filtros y paginación.

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
2. Aplicá la migración versionada de `supabase/migrations/` a la base elegida después de revisar el destino. La app espera el esquema en `public` y acceso mediante Data API.
3. Habilitá el proveedor Email/Password y mantené deshabilitados los inicios anónimos. Para solicitar confirmación por correo, configurá una Site URL de confianza en Auth y usá este enlace en la plantilla **Confirm signup**:

   ```html
   <a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}">Confirmar mi cuenta</a>
   ```

4. Ejecutá `npm run dev`. En el primer acceso se crean **Efectivo** y seis categorías editables. Un marcador por usuario, escrito en la misma transacción, evita duplicados y conserva los cambios que hagas a esas sugerencias. Cada cuenta empieza sin movimientos.

Si faltan las variables, la pantalla de acceso explica qué configurar. Las operaciones protegidas requieren una identidad verificada en el servidor. Mantené las claves secretas, los datos personales y los respaldos fuera del repositorio. [Autenticación SSR de Supabase](https://supabase.com/docs/guides/auth/server-side/creating-a-client) · [Plantillas de correo](https://supabase.com/docs/guides/auth/auth-email-templates)

## Cómo se calculan los saldos

- **Saldo neto del mes** = ingresos del mes menos gastos del mes. **Saldo disponible de una cuenta** = saldo inicial más todos sus ingresos menos todos sus gastos registrados. La cuenta admite un saldo inicial negativo.
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

Las acciones obtienen el usuario con `auth.getUser()` en el servidor. Las políticas de las tres tablas financieras limitan lectura, alta, modificación y borrado por `auth.uid()`. Una actualización valida tanto la fila original como su nueva propiedad. Las claves compuestas imponen el usuario de la cuenta y de la categoría y el tipo del movimiento. Las vistas y funciones financieras se ejecutan con los permisos de quien consulta. [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Pruebas y compilación

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:db
npx playwright install chromium
npm run test:e2e
```

`test:db` y `test:e2e` requieren la instancia **local de MiBalance** iniciada con `npm run db:start`. Las pruebas obtienen de la CLI sus credenciales locales, crean identidades descartables y las eliminan al terminar. Los accesos a las tablas se prueban con sesiones normales. La credencial administrativa queda en el proceso de pruebas. Se usa para generar un enlace de confirmación local, revocar la identidad de prueba y limpiar sus usuarios.

Playwright prueba la compilación de producción en un servidor propio en el puerto 3187, en escritorio y en viewport móvil. Ejecutá el build antes de las E2E. Los scripts de desarrollo y compilación usan Webpack para procesar SCSS Modules de forma consistente en Windows. Para servir la compilación manualmente, ejecutá `npm start -- --hostname 127.0.0.1`.

La entrega y verificación corresponden a la instalación local. En un proyecto alojado con confirmación habilitada, verificá la entrega de correo, el enlace de confirmación y las URL de Auth con el dominio elegido.

## Estado de dependencias

En la revisión del 17 de noviembre de 2026, `npm audit --omit=dev` señaló dos entradas de severidad alta, correspondientes a `picomatch` y a su dependencia inversa `@parcel/watcher`. La corrección compatible sugerida por npm también conservaba el aviso. MiBalance compila los SCSS con Sass Embedded y la búsqueda del historial utiliza PostgREST. El proyecto no usa patrones glob ingresados por usuarios. La actualización transitiva queda pendiente. [Aviso GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
