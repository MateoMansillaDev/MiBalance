# AGENTS.md — MiBalance

> Instrucciones permanentes para cualquier agente que trabaje en este repositorio.
> Proyecto: aplicación web personal para administrar ingresos, gastos y saldos.
> Idioma de trabajo: español (Argentina). Nombre del producto provisional y renombrable: **MiBalance**.

## 1. Objetivo del producto

Construir una aplicación web **real, privada, responsive y mantenible** para registrar ingresos y gastos, comprender en qué se usa el dinero y consultar saldos y evolución a lo largo del tiempo. Debe funcionar especialmente bien en escritorio y celular. Es una herramienta de registro y análisis personal, **no** una aplicación bancaria ni un asesor financiero.

### Principios de producto

- Simplicidad al cargar movimientos; la tarea más frecuente debe requerir pocos pasos.
- Exactitud contable en operaciones y totales; nunca se toleran errores por coma flotante.
- Privacidad por defecto; cada cuenta solo ve su propia información.
- Datos reales y persistentes; no presentar resultados de muestra como si fueran datos del usuario.
- Buen diseño, accesibilidad, estados de carga/vacío/error y experiencia móvil.
- Implementación incremental: no construir todas las ideas futuras en una sola fase.

## 2. Stack tecnológico

> **Desde la fase 5** los datos ya no usan Supabase: viven en el dispositivo (`src/local/`) y la app se exporta como sitio estático. Las secciones de Supabase, RLS y autenticación por correo describen fases anteriores; las reglas de dominio siguen vigentes y se aplican en `src/local/book.ts`.

- **Next.js** con **App Router**, **React**, **TypeScript** en modo estricto.
- **SCSS Modules** y variables/tokens de diseño; no Tailwind, salvo autorización expresa.
- **Supabase**: PostgreSQL para persistencia y Supabase Auth para autenticación.
- `@supabase/supabase-js` y `@supabase/ssr` según la documentación oficial vigente.
- **Zod** para validación de entradas y esquemas de dominio.
- **React Hook Form** para formularios, si aporta valor.
- **Recharts** para gráficos, si aporta valor y el paquete es compatible.
- **Vitest** para pruebas de unidades/lógica y **Playwright** para pruebas E2E, si se puede configurar de forma fiable.
- **npm** por defecto, con `package-lock.json` versionado (no mezclar gestores).
- Preparar una futura PWA, pero **no afirmar soporte offline** hasta haberlo implementado y probado.

Antes de añadir dependencias o usar API que puedan haber cambiado, consultar documentación oficial actual y elegir versiones estables compatibles. Evitar librerías innecesarias.

## 3. Alcance y fases

### Fase 1 — MVP funcional (prioridad actual)

1. Inicializar el proyecto y configurar calidad de código, estilos y documentación.
2. Autenticación con correo y contraseña, inicio/cierre de sesión y protección de rutas.
3. Modelo de datos y migraciones SQL para cuentas, categorías y movimientos financieros.
4. Crear una cuenta predeterminada para un usuario nuevo (por ejemplo, «Efectivo»), sin duplicarla al volver a entrar.
5. CRUD de cuentas financieras (p. ej., Efectivo, Banco, Billetera virtual).
6. CRUD de categorías, distinguiendo categorías de ingresos y de gastos, con algunas sugerencias iniciales que el usuario pueda editar.
7. CRUD de movimientos: ingreso/gasto, importe, fecha, cuenta, categoría, descripción o nota opcional.
8. Dashboard con ingresos, gastos y **saldo neto del período seleccionado**, sin confundirlo con el saldo total disponible por cuenta.
9. Vista de movimientos con búsqueda, filtros por fecha/tipo/cuenta/categoría, orden y paginación razonable.
10. Gráficos básicos de ingresos vs. gastos y gastos por categoría, calculados a partir de datos reales.
11. Diseño responsive, estados vacíos, errores claros, confirmación de borrado y accesibilidad básica.
12. README con instrucciones de ejecución, configuración de Supabase y pruebas.

**No incluir aún:** integraciones bancarias, OCR de tickets, presupuestos, suscripciones, reglas automáticas, transferencias entre cuentas, intercambio de divisas, modo multiusuario compartido, inteligencia artificial o notificaciones externas. Son fases futuras.

### Fase 2 — Control y planificación

- Presupuestos mensuales por categoría, comparativas y alertas locales.
- Movimientos recurrentes con generación idempotente y control de zona horaria.
- Exportación/importación de CSV con validación, vista previa y prevención de duplicados.
- Mejoras de reportes y filtros guardados.

### Fase 3 — Experiencia avanzada

- Transferencias entre cuentas como operaciones atómicas, **sin contarlas como ingreso/gasto**.
- PWA instalable, con soporte offline solo si se implementa sincronización segura y manejo de conflictos.
- Metas de ahorro, comparativas entre meses y personalizaciones.
- Opciones de despliegue y respaldo verificables.

### Fase 4 — Tarjetas, dólares y análisis (autorizada por el usuario)

- Tarjetas de crédito como tipo de cuenta y compras en cuotas atómicas e idempotentes.
- Cuentas en USD, compra y venta de dólares con dos importes y cotización de referencia manual; los resúmenes en ARS no mezclan monedas.
- Proyección de fin de mes, tendencia de seis meses, cambios por categoría y próximos vencimientos.
- Edición de transferencias, colores e íconos de categoría, íconos de la PWA y bloqueo local con PIN.

### Fase 5 — Local-first con Google Drive y app Android (autorizada por el usuario)

Decisión del usuario: los datos dejan de vivir en Supabase. Viven en el dispositivo y se sincronizan con un archivo en su propio Google Drive. La app se empaqueta para Android con Capacitor.

- **Etapa 1 — núcleo local** (`src/local/`): documento con un registro por id, sellos de modificación y lápidas; `Book` aplica las reglas que antes imponía PostgreSQL; `views.ts` reemplaza vistas y funciones; `merge.ts` combina copias (gana la última escritura, conmutativa e idempotente); IDs estables para sugerencias, vencimientos y cuotas para no duplicar entre dispositivos; persistencia en IndexedDB.
- **Etapa 2 — pantallas**: componentes cliente sobre el núcleo local, sin Supabase, server actions ni middleware; `output: 'export'`.
- **Etapa 3 — Drive**: inicio de sesión con Google, scope no sensible `drive.appdata`, archivo único en la carpeta de datos de la app, combinar antes de subir.
- **Etapa 4 — Android**: Capacitor, inicio de sesión nativo de Google, APK.

Reglas de esta fase: el documento leído de Drive o del dispositivo se valida con Zod antes de usarse; ningún secreto de cliente OAuth en el código; los importes siguen en centavos como texto y se suman con `bigint`; Supabase y sus pruebas se retiran recién cuando la etapa 2 esté verificada.

**No avanzar de fase sin autorización del usuario.**

## 4. Reglas del dominio financiero

- Moneda predeterminada para la Fase 1: **ARS** (pesos argentinos). Idioma y formato: `es-AR`.
- Almacenar importes en **centavos enteros positivos** (`BIGINT` en PostgreSQL), nunca en `float`/`double`.
- La dirección del movimiento indica `income` o `expense`; el importe siempre es positivo.
- Parsear y validar los importes ingresados como texto decimal (ej. `1234,50` o formato normalizado) de forma explícita antes de convertir a centavos.
- Para sumas/restas usar enteros o `bigint`; si el código serializa `bigint` a JSON, hacerlo expresamente (por ejemplo, como cadena), nunca por conversión implícita.
- Definir y probar el comportamiento de `1.234,56`, `1234,56`, `1234.56`, valores negativos, cero y entradas inválidas.
- Fechas de los movimientos como **DATE** (fecha calendario, sin desplazamientos UTC); zona horaria de referencia: **America/Argentina/Cordoba**.
- El saldo neto del período es `ingresos del período − gastos del período`.
- El saldo de una cuenta se determina por su saldo inicial (si existe) más ingresos menos gastos asignados a esa cuenta desde el inicio; no se debe llamar «saldo total» al neto mensual.
- Definir claramente los límites del período y la inclusión de fechas en filtros. Mantener resultados consistentes entre tablas, métricas y gráficos.
- No almacenar información financiera inventada como dato real. Semillas de ejemplo solo para desarrollo/pruebas, rotuladas y nunca insertadas automáticamente en una cuenta real.
- Los cambios de categorías/cuentas no deben provocar que desaparezca el historial. Usar bloqueo de borrado si existen movimientos, o una estrategia explícita de archivado.
- Validar que una categoría de ingreso no se pueda asociar a un gasto ni viceversa.

## 5. Modelo de datos y aislamiento

Modelo recomendado para la primera fase:

- `accounts`: `id`, `user_id`, `name`, `kind`, `opening_balance_cents`, `is_archived`, timestamps.
- `categories`: `id`, `user_id`, `name`, `type` (`income`/`expense`), `color` o ícono opcional, `is_archived`, timestamps.
- `transactions`: `id`, `user_id`, `account_id`, `category_id`, `type`, `amount_cents`, `occurred_on`, `description`, timestamps.

Requisitos:

- Todas las tablas con información privada llevan `user_id` y **RLS habilitado**.
- Políticas explícitas `SELECT`, `INSERT`, `UPDATE`, `DELETE` limitadas a `(select auth.uid()) = user_id`; para `UPDATE`, usar también `WITH CHECK`.
- Comprobar que `account_id` y `category_id` pertenecen al mismo usuario, tanto en validación de servidor como a nivel de esquema cuando sea posible (por ejemplo, claves compuestas).
- Índices orientados a `user_id`, fecha y filtros habituales.
- Restricciones SQL para importes positivos, tipos válidos y claves foráneas.
- Migraciones versionadas en `supabase/migrations/`; nunca depender solo de cambios manuales en el panel.
- Si hay funciones o vistas SQL, seguir el principio de mínimo privilegio. No usar `SECURITY DEFINER` para evitar solucionar permisos correctamente; las vistas expuestas deben respetar RLS.
- Probar explícitamente que un segundo usuario **no** puede leer, modificar ni eliminar datos del primero.

## 6. Autenticación y seguridad

- Usar sesiones y cookies según la documentación actual de Supabase SSR y Next.js.
- Verificar la identidad en el servidor para operaciones protegidas; no confiar en un `user_id` recibido del navegador.
- No exponer jamás `service_role`, claves secretas ni credenciales en el frontend o en `NEXT_PUBLIC_*`.
- En el cliente usar solamente las claves publicables previstas para ello.
- **Nunca** commitear `.env.local`, credenciales, tokens, datos financieros reales o backups con información personal.
- Incluir `.env.example` con valores ficticios y explicación de cada variable.
- Validar y autorizar cada operación de escritura; manejar errores sin filtrar información privada a otros usuarios.
- Evitar registrar importes, descripciones sensibles o correos completos en logs de producción.
- No habilitar acceso anónimo a información financiera privada.
- No pedir permisos de banco, email o tarjeta en el MVP.
- No realizar despliegues públicos ni cambios de infraestructura remota sin autorización.

## 7. Arquitectura y convenciones

Organizar por responsabilidades, evitando archivos gigantes. Estructura sugerida (adaptar según necesidad):

```text
src/
  app/                  # rutas, layouts y límites servidor/cliente
  components/           # componentes reutilizables y UI
  features/
    auth/
    accounts/
    categories/
    transactions/
    dashboard/
  lib/
    supabase/            # cliente, servidor y sesión
    money/               # parseo, formato, operaciones exactas
    dates/               # manejo de fechas calendario
    validation/          # esquemas compartidos
  styles/                # tokens, globales, mixins SCSS
supabase/
  migrations/
tests/
```

- Mantener lógica de negocio separada de componentes de interfaz.
- Preferir Server Components para lectura y componentes cliente para interacciones necesarias; no exponer secretos.
- Server Actions y/o Route Handlers deben validar autenticación, permisos y entradas.
- TypeScript estricto, sin `any` injustificado, sin silenciamiento de errores por comodidad.
- Reutilizar componentes con responsabilidad clara.
- Componentes accesibles por teclado, etiquetas asociadas a formularios, contraste legible y estados de foco visibles.
- Preferir nomenclatura de código consistente en inglés y textos de interfaz en español (Argentina).

## 8. Diseño y experiencia de usuario

- Interfaz **limpia, moderna y profesional**, optimizada para celular y escritorio.
- Tema oscuro y claro mediante tokens; elegir por sistema y permitir preferencia si resulta viable en MVP.
- **SCSS Modules obligatorios** para estilos de componentes. Sin Tailwind, estilos inline masivos ni bibliotecas visuales pesadas sin justificación.
- Navegación simple: Resumen, Movimientos, Cuentas, Categorías, Configuración.
- Acción destacada para «Agregar movimiento»; elegir ingreso o gasto, monto y categoría rápidamente.
- Mostrar montos con `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })` u otro formateador exacto compatible con la representación de enteros.
- Gráficos y tablas deben ofrecer leyendas/alternativas accesibles y estados sin datos.
- No saturar la interfaz con animaciones; respetar `prefers-reduced-motion`.
- Evitar presentar estimaciones como si fueran datos precisos.

## 9. Pruebas y criterios de aceptación

Antes de dar por terminada una tarea:

1. Ejecutar los scripts disponibles de lint, typecheck, tests y build.
2. Probar parseo/formato de centavos, fechas, totales y saldos de cuentas, incluyendo casos límite.
3. Probar creación, edición y eliminación confirmada de movimientos.
4. Verificar que filtros, tablas y dashboard coinciden para el mismo período.
5. Verificar casos de error: conexión fallida, formulario inválido, sesión vencida, recurso ajeno.
6. Probar rutas protegidas sin sesión.
7. Probar RLS de forma aislada entre al menos dos usuarios de prueba (cuando haya entorno de BD disponible).
8. Verificar disposición responsive y uso de teclado.
9. No declarar pruebas E2E o seguridad completadas si no se ejecutaron; especificar bloqueos y pasos manuales.

Nunca inventar resultados de pruebas. Si faltan credenciales de Supabase, implementar el código/migraciones y ejecutar lo verificable sin ellas, dejando documentado qué pruebas quedan pendientes. No reemplazar silenciosamente la persistencia real por mocks.

## 10. Forma de trabajo del agente

- Leer este `AGENTS.md`, inspeccionar el repositorio y revisar cambios existentes antes de modificar archivos.
- Si existe código previo, respetar su estructura y no sobrescribir trabajo ajeno.
- Planificar brevemente el cambio, implementar el mínimo funcional y verificarlo.
- Trabajar por fases y tareas pequeñas, manteniendo la app compilable.
- Consultar documentación oficial si hay dudas o API recientes; no suponer que un ejemplo viejo sigue vigente.
- No introducir dependencias sin utilidad clara; fijar versiones compatibles y actualizar lockfile.
- No hacer operaciones destructivas de BD ni migraciones remotas sin autorización.
- No ejecutar `git push`, crear PR, desplegar o modificar credenciales externas sin permiso explícito.
- Explicar al terminar: archivos relevantes, funcionalidad implementada, pruebas corridas, errores pendientes y próximos pasos.
- Si detectás una contradicción entre documentación y código, señalarla y proponer corrección sin ocultarla.

## 11. Autoría, firmas y atribuciones

**Nada del proyecto debe quedar firmado, atribuido o presentado como creado por Codex u otra IA.**

- No añadir `Co-authored-by: Codex`, `Co-authored-by: ChatGPT` ni trailers equivalentes a commits.
- No agregar textos como `Generated by Codex`, `Created with AI`, `AI-assisted`, `Written by ChatGPT` en archivos, comentarios, documentos, PRs o changelogs.
- No agregar logos, marcas de agua, créditos ni firmas de IA en la interfaz o los entregables.
- No configurar, cambiar ni suplantar la identidad de Git del usuario.
- No hacer commits automáticamente salvo que el usuario los pida; si los pide, utilizar únicamente la identidad Git previamente configurada.
- **Excepción obligatoria:** conservar avisos de copyright, licencias y atribuciones de terceros exigidas legalmente o por sus licencias. Esta regla no autoriza eliminarlos.

## 12. Definición de terminado de la Fase 1

La primera fase está completa **solo si** un usuario puede registrarse/iniciar sesión, crear cuentas y categorías, cargar/editar/eliminar ingresos y gastos persistidos en Supabase, consultar filtros y resúmenes coherentes, cerrar sesión, y otro usuario no puede acceder a sus datos. El proyecto debe incluir migraciones, documentación y un conjunto de pruebas ejecutables.

Si el agente no puede comprobar un requisito por falta de conexión o credenciales, declararlo **pendiente de verificación** en lugar de marcar la fase como terminada.
