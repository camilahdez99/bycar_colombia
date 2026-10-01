# Backlog de deuda técnica

Relevamiento de código: 2026-09-30 (solo lectura; no se modificó código). Reemplaza al backlog anterior: sus ítems abiertos están integrados acá y los cerrados figuran en el [historial](#historial-ítems-cerrados).

## Cómo leerlo

- **Categorías:** `organización` · `código muerto` · `duplicación` · `performance` · `seguridad` · `legibilidad` · `dependencias` · `bd-pendiente` (fuera de alcance, sin priorizar).
- **Riesgo:** probabilidad de romper algo al hacer el cambio (bajo / medio / alto).
- **Impacto:** beneficio de hacerlo (bajo / medio / alto).
- **Esfuerzo:** S (horas) · M (1 a 3 días) · L (más de 3 días).
- **Orden:** primero riesgo bajo + impacto alto; después impacto medio; después riesgo medio; al final riesgo alto. Dentro de cada bloque, de menor a mayor esfuerzo.
- ✅ hecho · 🟡 parcial · ⏸️ en espera o reclasificado.
- ⚠️ = requiere confirmación antes de ejecutar (regla 6 de `CLAUDE.md`: borrar archivos, tocar dependencias o cambiar contratos de API).
- Los bugs no se listan acá: están en [`BUGS.md`](BUGS.md). Cuando un ítem depende de un bug, se cita su número.

## Pendiente operativo (no es deuda de código)

- [ ] **Rollout de auth.** Ejecutar [`ROLLOUT_AUTH.md`](ROLLOUT_AUTH.md): configurar `SESSION_SECRET`, desplegar con el flag apagado, verificar HTTPS y prender `AUTH_ENFORCED=true`. Lo hace una persona porque toca configuración de producción. Hasta entonces, producción sigue sin autenticación (S1–S3, S6).

## 1. Riesgo bajo · impacto alto

| ID | Descripción | Archivos | Categoría | Riesgo | Impacto | Esf. |
|---|---|---|---|---|---|---|
| DT-01 | ✅ **Tests de caracterización del frontend.** Prerrequisito de todo refactor de UI (regla 2). **Hecho (2026-09-30):** helpers del dashboard, `DynamicForm`, CRUD del panel admin, y además los flujos de punta a punta del dashboard (publicar, buscar y solicitar, solicitudes recibidas, chat, guardián con temporizador, menú por permisos, refresco periódico), login, register y `PermisosManager`. El dashboard pasó de 53 % a 95 % de sentencias. Queda la landing (`app/page.jsx`, 58 %), sin lógica de negocio. | `app/dashboard/page.jsx`, `app/admin/page.jsx`, `components/DynamicForm.jsx`, `__tests__/app/` | legibilidad | bajo | alto | M |
| DT-02 | ✅ **Extraer helpers puros del dashboard a `lib/`** (hecho 2026-09-30: `lib/client/formato.js`, `usuario.js`, `badges.js`), con los tests de DT-01. Incluye un `getUserId(user)`: la expresión `ID_USU \|\| id_usu \|\| id` está copiada 8 veces (`:192, 260, 380, 475, 500, 548, 570, 610`). | `app/dashboard/page.jsx:9-11, 449-458, 639-662` | duplicación | bajo | alto | S |
| DT-03 | 🟡 **Envoltorio común para los route handlers.** **Parcial (2026-09-30):** el cierre ya es común (`lib/api/connection.js`, salvo `tablas` y `guardian` por E2); falta un `withConnection` que unifique también el `try/catch`. Los 35 handlers repiten `authorize` + `getConnection` + `try/catch` + `finally close`, con tres estilos distintos de cierre (`try { close } catch (err) {}`, `catch {}`, y `close()` sin proteger en `tablas` y `guardian`, ver E2). Un helper `withConnection` unifica el cierre y el log de error sin tocar las queries. Ya hay tests de caracterización de las 17 rutas. | `app/api/**/route.js`, nuevo `lib/api/` | duplicación | bajo | alto | M |
| DT-04 | ✅ **Logger estructurado** (hecho 2026-09-30: `lib/log.js`; los `console.log` de depuración pasaron a `logInfo`). Hay 59 `console.*`: solo los de `lib/auth` emiten JSON. Dos `console.log` de depuración registran IDs de usuario en cada request (`mensajes/chats/route.js:49`, `solicitudes/route.js:98`). `console.error(…, error)` vuelca el objeto de error de Oracle completo. | `app/api/**`, `lib/db.js:23`, nuevo `lib/log.js` | seguridad | bajo | alto | S |
| DT-05 | ✅ **28 `catch` vacíos** (hecho 2026-09-30; quedan solo en los `Formulario*` sin uso, DT-20) (E3): casi todos al cerrar la conexión; además `dashboard/page.jsx:189` (JSON de `localStorage` corrupto) y `FormularioConductor/Vehiculo`. Viola el estándar "nada de `catch` vacíos". Se resuelve casi entero con DT-03 + DT-04. | `app/api/**`, `app/dashboard/page.jsx:189` | legibilidad | bajo | alto | S |
| DT-06 | **No devolver `error.message` de Oracle al cliente** (S8): 17 respuestas lo exponen (nombres de tablas, constraints y columnas). Responder un mensaje genérico y dejar el detalle en el log. Cambia el texto del body de error: hay que actualizar los snapshots a propósito. | `admin/tablas:127,231,310,365`, `guardian:98,147,202`, `admin/permisos:57,84,111`, `viajes:198`, `admin/usuarios:67,134`, `admin/vehiculos:80,147`, `admin/viajes:61`, `admin/conductores:74` | seguridad | bajo | alto | S |
| DT-07 | 🟡 **Extraer la lógica embebida en handlers a funciones puras con tests.** **Parcial (2026-09-30):** estados de solicitud, limpieza de viaje y receptor en `lib/domain/`. Queda la resolución texto-o-número de `guardian` y `admin/viajes`, que decide entre dos SQL distintos. Original: mapa de estados de solicitud (`solicitudes/route.js:69-81`), limpieza de placa / puestos / valor / comentarios (`viajes/route.js:158-160, 185`), cálculo del receptor (`mensajes/route.js:108-109`), resolución de estado texto-o-número (copiada en `guardian/route.js:176-193` y `admin/viajes/route.js:85-101`). | los citados, nuevo `lib/domain/` | duplicación | bajo | alto | M |

## 2. Riesgo bajo · impacto medio

| ID | Descripción | Archivos | Categoría | Riesgo | Impacto | Esf. |
|---|---|---|---|---|---|---|
| DT-08 | ✅ **Constantes de dominio en un solo lugar.** (hecho 2026-09-30: `lib/domain/constantes.js`) Valores mágicos dispersos: estados de solicitud 1–4 (`solicitudes:8-9,38,69-77`; `guardian:41,56,88,89`; `chats:42`; `recibidas:34`; `admin/viajes:22`), estados de guardián 1/2 (`guardian:56,89,133`), estado de viaje 1 (`viajes:107,190`), perfil 2 (`register:29`, `admin/usuarios:52`), menú raíz `id === 1` (`dashboard:668-669`, `PermisosManager:67-68`). Solo `ESTADO_SOLICITUD_ACEPTADA` tiene nombre (`ownershipQueries.js:4`). En el código JS se pueden nombrar ya; los literales dentro del SQL quedan como `bd-pendiente` (BD-07). | los citados, nuevo `lib/domain/constants.js` | legibilidad | bajo | medio | S |
| DT-09 | ✅ **Constantes de configuración del frontend.** (hecho 2026-09-30) Intervalos de polling 10 000 y 3 000 ms (`dashboard:314, 493`), pre-alerta a 300 s (`:345, 993-1017`), extensión de 15 min (`:438, 441`), tiempo por defecto 30 (`:145`; también `guardian/route.js:141`), tope de 500 caracteres y 6 de placa (`viajes:158,160`; `admin/vehiculos:50`). | `app/dashboard/page.jsx`, `app/api/viajes/route.js`, `app/api/guardian/route.js` | legibilidad | bajo | medio | S |
| DT-10 | ✅ **Código muerto menor.** (hecho 2026-09-30) `dashboard/page.jsx`: import `useCallback` (`:3`), variable `pId` (`:193`; además siempre null, F7), estado `guardianFinalizado` que se escribe y nunca se lee (`:150`), comentario duplicado (`:256-257`), `setMensajes(prev => …)` que no usa `prev` y llama a otro `setState` dentro del updater (`:288-294`). `DynamicForm.jsx`: import `toast` (`:3`), prop `table` sin uso, JSDoc con nombres de props que ya no existen (`:5-13`), `async` innecesario (`:36`). `marcas/route.js:6` y `municipios/route.js:6`: parámetro `req` sin uso. `tablas/route.js:1`: línea en blanco inicial. | los citados | código muerto | bajo | medio | S |
| DT-11 | ✅ **`cerrarSesion` duplicado.** (hecho 2026-09-30) El dashboard tiene su propia versión (`:629-637`) en vez de `lib/client/logout.js`. Diferencia: `router.push('/')` frente a una navegación completa (que además corta los intervalos). | `app/dashboard/page.jsx`, `lib/client/logout.js` | duplicación | bajo | medio | S |
| DT-12 | ✅ **Caché de catálogos.** (hecho 2026-09-30, detrás de `CATALOG_CACHE_SECONDS`) `menus`, `marcas` y `municipios` (1 021 filas) se consultan a Oracle en cada carga del dashboard y de `PermisosManager`, abriendo una conexión cada vez. Son datos casi estáticos: alcanza con `Cache-Control` o una caché en memoria con TTL. No toca el SQL. | `app/api/menus`, `marcas`, `municipios` | performance | bajo | medio | S |
| DT-13 | ✅ **Doble carga al entrar al dashboard.** (hecho 2026-09-30) El efecto de montaje (`:182-254`) pide `mis-rutas` y `chats`; al setear `currentUser` se dispara el efecto de refresco (`:258-316`), que los vuelve a pedir de inmediato. Son 2 requests (y 2 conexiones a Oracle) de más por carga. | `app/dashboard/page.jsx` | performance | bajo | medio | S |
| DT-14 | ✅ **`key` inestable en la tabla admin:** (hecho 2026-09-30) `key={getRowId(row) \|\| Math.random()}` remonta la fila en cada render cuando no hay ID (`:260`). Relacionado con F31. | `app/admin/page.jsx:234-236, 260` | performance | bajo | medio | S |
| DT-15 | ✅ **`handleCreate` / `handleUpdate` / `handleDelete` casi idénticos** (hecho 2026-09-30) (toast + fetch + refresco + manejo de error). `refreshData` repite el fetch del efecto de carga y no valida `res.ok`. | `app/admin/page.jsx:103-173` | duplicación | bajo | medio | S |
| DT-16 | ✅ **`getPrimaryKey` y `getPrimaryKeyColumns` conviven** (hecho 2026-09-30): GET usa la primera columna y PUT/DELETE validan PK compuesta. El tratamiento del `id` difiere por método (F14). Unificar en una sola función (sin cambiar el SQL). | `app/api/admin/tablas/route.js:18-40` | duplicación | bajo | medio | S |
| DT-17 | ✅ **Documentar las excepciones a `fetchConSesion`.** (hecho 2026-09-30) `login` y `register` usan `fetch` directo (`login/page.jsx:22`, `register/page.jsx:23`). Es correcto (un 401 por credenciales inválidas dispararía `expireSession`), pero contradice la regla de `CLAUDE.md` tal como está escrita. | `CLAUDE.md`, `docs/ARCHITECTURE.md` | legibilidad | bajo | medio | S |
| DT-18 | ✅ **`README.md` es el de `create-next-app`** (hecho 2026-09-30): menciona Geist y `app/page.js`, que no existen, y no explica variables de entorno ni scripts. Falta también un listado de variables requeridas (no se puede crear `.env.example` sin autorización: regla 7). | `README.md` | organización | bajo | medio | S |
| DT-19 | ✅ **Sin CI.** (hecho 2026-09-30: `.github/workflows/ci.yml`; el lint corre como informativo hasta DT-38) No hay `.github/` ni otro pipeline: tests, build y lint dependen de que alguien los corra a mano. | nuevo workflow | organización | bajo | medio | S |

## 3. Riesgo bajo · impacto bajo

| ID | Descripción | Archivos | Categoría | Riesgo | Impacto | Esf. |
|---|---|---|---|---|---|---|
| DT-20 | ✅ **Componentes sin uso:** (hecho 2026-09-30) `FormularioConductor.jsx` y `FormularioVehiculo.jsx` no se importan en ningún lado; además usan `fetch` directo y `catch` vacío. | `components/admin/Formulario*.jsx` | código muerto | bajo | bajo | S |
| DT-21 | ✅ **`lib/municipios.js` sin uso en la app** (hecho 2026-09-30) (12 KB, 1 021 nombres): solo lo importa su propio test. Los municipios se leen de la BD. | `lib/municipios.js`, `__tests__/lib/municipios.test.js` | código muerto | bajo | bajo | S |
| DT-22 | ✅ **Assets de plantilla sin referencias:** (hecho 2026-09-30) `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`. | `public/*.svg` | código muerto | bajo | bajo | S |
| DT-23 | ✅ **`scripts/create_admin_user.js` no puede correr:** (hecho 2026-09-30; cierra F32) importa con el alias `@/` (Node no lo resuelve) e inserta en columnas que no existen (`NOMBRE`, `APELLIDO`, `CORREO`, `CONTRASENA`). Tiene la contraseña `admin` hardcodeada (S5) y usa `admin@bycar.com`, distinto del `admin@bycar.co` del login. | `scripts/create_admin_user.js` | código muerto | bajo | bajo | S |
| DT-24 | ✅ **`tailwind.config.js` parece no tener efecto.** (hecho 2026-09-30: el CSS compilado es idéntico con y sin el archivo) Con Tailwind 4 la config JS solo se carga con `@config`, y `globals.css` no tiene `@config` ni `@plugin "daisyui"`. Apunta además a `./pages/**`, que no existe. No se encontraron clases de daisyUI en uso (los `btn-red` son CSS propio). Verificar con un build antes de tocar. | `tailwind.config.js`, `app/globals.css` | código muerto | bajo | bajo | S |
| DT-25 | 🟡 **Dependencias sin uso aparente:** (hecho 2026-09-30: `daisyui` y `geist` desinstalados. Quedan la fijación exacta de `react` y los avisos de `approve-scripts`) `geist` (ningún import; el layout usa `Inter`) y `daisyui` (ver DT-24). `react` y `react-dom` están fijados en versión exacta y el resto con `^`. Siguen pendientes los avisos de `npm approve-scripts` (`oracledb`, `sharp`, `unrs-resolver`). | `package.json` | dependencias | bajo | bajo | S |
| DT-26 | ⏸️ **Tipografías.** **Reclasificado a riesgo medio (2026-09-30):** Inter sí se usa (define `--font-sans`, la tipografía por defecto del panel admin). Pasar Syne y DM Sans a `next/font` obliga a reemplazar 42 referencias literales en 6 archivos, sin tests visuales. `globals.css:1` carga Syne y DM Sans con `@import url(…)`, que bloquea el render, mientras el layout carga `Inter` con `next/font`. Verificar si Inter se usa en algún lado y pasar las otras dos a `next/font`. | `app/globals.css`, `app/layout.js` | performance | bajo | bajo | S |
| DT-27 | ✅ **`scripts/` mezcla cosas distintas:** (hecho 2026-09-30: `scripts/README.md`; no se movieron archivos. Se detectó S9) DDL/DML de referencia en `.txt`, un diagrama, un script roto (DT-23), uno con credenciales excluido de git (S7) y el verificador vigente. El seed `insercion_data_DML.txt:16` incluye la credencial del admin (S5). | `scripts/` | organización | bajo | bajo | S |
| DT-28 | ⏸️ **Imagen externa por hotlink** **Pendiente de decisión:** alojar la imagen implica descargarla y revisar su licencia. en el fondo del login (`images.unsplash.com`): dependencia de un tercero en tiempo de ejecución. | `app/login/page.jsx:69` | organización | bajo | bajo | S |
| DT-29 | ⏸️ **Configuración de `oracledb` redundante:** **Reclasificado a `bd-pendiente` (2026-09-30):** las opciones de `execute` son parte de la interacción con Oracle y están fijadas en los snapshots. `lib/db.js:4` fija `outFormat` global, pero 9 rutas lo vuelven a pasar en cada `execute` y otras no. | `lib/db.js`, `app/api/**` | legibilidad | bajo | bajo | S |
| DT-30 | ⏸️ **`conductores` devuelve `id` e `idUsuario` con el mismo valor** **Reclasificado (2026-09-30):** el alias duplicado está en el texto del SQL (`bd-pendiente`), el `POST` no-op es el bug F26 y la ruta entera es candidata a DT-46. (`:17-18`), y `POST` es un no-op (F26). | `app/api/admin/conductores/route.js` | legibilidad | bajo | bajo | S |
| DT-49 | ⚠️ **Medición de cobertura en el repo.** No hay `@vitest/coverage-v8`: la medición del 2026-09-30 se hizo con un clon temporal fuera del repo. Agregarlo como devDependency (misma versión que `vitest`) y sumar un script `test:coverage`, y opcionalmente un umbral en CI. Requiere confirmación (regla 6). Al activarlo, excluir `app/layout.js`: el provider v8 no parsea JSX en archivos `.js` que no importa ningún test. | `package.json`, `vitest.config.mjs` | dependencias | bajo | bajo | S |

## 4. Riesgo medio · impacto alto

| ID | Descripción | Archivos | Categoría | Riesgo | Impacto | Esf. |
|---|---|---|---|---|---|---|
| DT-31 | **Validación de entrada centralizada.** Ningún handler valida tipos ni rangos del body o la query: solo se chequea presencia. De ahí salen F6, F17, F20, F23, F24, F25 y E5. Un validador por ruta (esquema declarativo) antes de abrir la conexión. Cambia respuestas de 500 a 400: es cambio de comportamiento y va junto con el fix de cada bug. | `app/api/**/route.js`, nuevo `lib/api/validate.js` | seguridad | medio | alto | M |
| DT-32 | **Límite de intentos en `auth/login` y `auth/register`.** Hoy se pueden probar contraseñas sin tope, y además se comparan en texto plano (S4). `register` es público y crea usuarios con todos los permisos sin verificación de correo ni política de contraseña. Detrás de feature flag. | `app/api/auth/login`, `app/api/auth/register` | seguridad | medio | alto | M |
| DT-33 | **Polling del dashboard.** Cada 10 s pide `mis-rutas` y `chats` (más `recibidas` o `guardian` según la pestaña) y cada 3 s el historial completo del chat abierto. Cada request abre una conexión nueva a Oracle (BD-06). No se pausa con la pestaña oculta ni aplica backoff ante errores. Opciones: pausar con `visibilitychange`, pedir solo mensajes nuevos, unificar en un endpoint de resumen. | `app/dashboard/page.jsx:258-316, 487-496` | performance | medio | alto | M |
| DT-34 | **Dividir `app/dashboard/page.jsx`** (1 298 líneas, ~30 `useState`, 171 estilos inline, 6 pestañas y 4 modales en un solo componente). Propuesta por pasos, cada uno con tests previos (DT-01): (1) helpers, DT-02; (2) `Autocomplete` y modales a archivos propios; (3) un hook por dominio (`useGuardian`, `useChat`, `useRutas`); (4) un componente por pestaña. | `app/dashboard/page.jsx` | organización | medio | alto | L |
| DT-35 | **Temporizador del guardián.** El contador vive en el estado raíz: todo el dashboard se vuelve a renderizar cada segundo, incluidos los `Autocomplete`, que filtran 1 021 municipios. Descuenta 1 por tick de `setInterval` en vez de calcular contra la hora de inicio, así que se atrasa con la pestaña en segundo plano. Los efectos secundarios (`toast`, `fetch`) están dentro del updater de `setState`. Relacionado con F28. | `app/dashboard/page.jsx:336-372, 13-94` | performance | medio | alto | M |
| DT-36 | **La identidad viaja desde el cliente.** El frontend lee el usuario de `localStorage` y manda `usuarioId` / `senderId` en cada request; el servidor lo compara con la sesión. Con `AUTH_ENFORCED` estable, el servidor debería tomar el ID de la sesión y dejar de recibirlo. ⚠️ Cambia el contrato de la API. Depende del rollout. | `app/dashboard/page.jsx`, `app/api/**` (rutas de usuario) | seguridad | medio | alto | M |
| DT-37 | **Quitar el admin hardcodeado** (S5) y derivar el rol de `PERFIL_ID_PER`. El admin hoy no tiene `userId`. Requiere una query nueva: depende de habilitar la BD. | `app/api/auth/login/route.js:30-36`, `lib/auth/session.js` | seguridad | medio | alto | M |
| DT-38 | **Lint en rojo en la línea base:** 5 errores y 3 warnings, sobre todo `react-hooks/set-state-in-effect` en `DynamicForm.jsx:17-29` y `HydrationWrapper.jsx:6-8`. Mientras falle no puede ser obligatorio en la suite ni en CI (DT-19). Corregirlo implica cambiar cómo se inicializa el formulario y cómo se evita la hidratación. | `components/DynamicForm.jsx`, `components/admin/HydrationWrapper.jsx`, otros | legibilidad | medio | alto | M |

## 5. Riesgo medio · impacto medio o bajo

| ID | Descripción | Archivos | Categoría | Riesgo | Impacto | Esf. |
|---|---|---|---|---|---|---|
| DT-39 | **Headers de seguridad.** `next.config.mjs` está vacío: no hay CSP, `X-Frame-Options`, `Referrer-Policy` ni HSTS. La CSP choca con los `<style>` inline y las fuentes externas, por eso el riesgo. ⚠️ Es configuración que llega a producción. | `next.config.mjs` | seguridad | medio | medio | M |
| DT-40 | **Dos sistemas de estilos.** Admin usa clases de Tailwind; landing, login, register y dashboard usan `<style>` globales por página e inline. `:root` con las mismas variables (`--red`, `--bg`, `--border`…) se redefine en 5 archivos con valores levemente distintos (`--border` .08 o .1, `--muted` .5 o .55). Las reglas globales apuntan a selectores de elemento (`body`, `input`, `label`, `h1`). El logo SVG está copiado en 4 archivos. No hay tests visuales. | `app/globals.css`, `app/page.jsx:67-425`, `app/login/page.jsx:48-96`, `app/register/page.jsx:51-93`, `app/dashboard/page.jsx:688-737` | duplicación | medio | medio | L |
| DT-41 | **`HydrationWrapper` anula el SSR** de dashboard y admin (renderiza `null` hasta montar) y el layout suma `suppressHydrationWarning` en `html` y `body`. Tapa el problema de fondo: leer `localStorage` durante el render. Vive en `components/admin/` pero lo usa el dashboard. | `components/admin/HydrationWrapper.jsx`, `app/layout.js:18-19` | performance | medio | medio | M |
| DT-42 | **El frontend conoce el esquema de Oracle.** El dashboard lee `ID_USU`, `NOMBRE_USU`, `CORREO_USU` porque el login devuelve la fila cruda (`login/route.js:41, 51`); el panel admin depende de `user_tables` y `COLUMN_NAME`, y `getRowId` lleva una lista manual de PKs (`admin/page.jsx:235`) que el servidor ya sabe calcular. Un rename de columna rompe la UI. ⚠️ Normalizar el usuario cambia el contrato del login. | `app/api/auth/login/route.js`, `app/dashboard/page.jsx`, `app/admin/page.jsx` | organización | medio | medio | M |
| DT-43 | **Dos carpetas de componentes:** `components/` (raíz) y `app/components/`. `PermisosManager` está en la segunda y `DynamicForm` en la primera, sin criterio visible. | `components/`, `app/components/` | organización | medio | bajo | S |
| DT-44 | **Sesión sin revocación.** El JWT dura 7 días; el logout borra la cookie pero el token sigue siendo válido hasta vencer, y no hay rotación. Aceptable hoy; revisar cuando el rol salga de la BD (DT-37). | `lib/auth/session.js` | seguridad | medio | bajo | M |
| DT-45 | **La landing es un client component completo** (570 líneas, ~360 de CSS en `dangerouslySetInnerHTML`). Solo necesitan cliente el contador, el scroll del nav y las animaciones. | `app/page.jsx` | performance | medio | bajo | M |

## 6. Riesgo alto

| ID | Descripción | Archivos | Categoría | Riesgo | Impacto | Esf. |
|---|---|---|---|---|---|---|
| DT-46 | ⚠️ **Cuatro rutas admin sin consumidor:** `admin/usuarios`, `admin/conductores`, `admin/vehiculos` y `admin/viajes` (487 líneas más sus tests) no las llama ninguna UI; el panel usa solo `admin/tablas` y `admin/permisos`. Duplican lo que hace el CRUD genérico y arrastran bugs propios (F16–F19, F26). Borrarlas elimina endpoints públicos: confirmar antes que no haya consumidores externos. | `app/api/admin/{usuarios,conductores,vehiculos,viajes}/route.js` | código muerto | alto | medio | S |
| DT-47 | **Hash de contraseñas** (S4) con migración de las existentes. Toca BD y login. | `app/api/auth/*`, `app/api/admin/usuarios` | seguridad | alto | alto | L |
| DT-48 | **CRUD genérico sobre cualquier tabla.** `admin/tablas` permite leer y escribir todo `user_tables`, incluidas las contraseñas (S2), con nombres de tabla y columna interpolados (BD-01). Reemplazarlo por una lista blanca de tablas y columnas es un rediseño. | `app/api/admin/tablas/route.js`, `app/admin/page.jsx` | seguridad | alto | alto | L |

## bd-pendiente (sin priorizar)

Fuera de alcance hasta que se habilite trabajar la BD. No se modifica esquema ni texto de queries.

| ID | Descripción | Archivos |
|---|---|---|
| BD-01 | Nombres de tabla y columna interpolados en el SQL (mitigado con regex y lista de columnas). La PK puede venir `undefined` y el `SET` puede quedar vacío (F13, F15). | `admin/tablas/route.js:112-113, 182-186, 292-296, 348-351` |
| BD-02 | IDs generados con `MAX+1` (condición de carrera). | `admin/usuarios/route.js:47`, `viajes/route.js:25, 65` |
| BD-03 | IDs generados con `Date.now()`. Usar secuencias o `IDENTITY`. | `auth/register:16`, `guardian:129`, `mensajes:112`, `solicitudes:34`, `viajes:184` |
| BD-04 | `POST viajes`: varios `autoCommit` sin transacción, que dejan municipios, marcas o vehículos huérfanos si falla el último insert. Los municipios nuevos quedan con `DEPARTAMENTO_ID_DEP = 1` fijo. | `viajes/route.js:28-32, 69-73, 176-193` |
| BD-05 | Dos `DELETE` sin transacción explícita (el primero depende del `autoCommit` del segundo). | `admin/conductores/route.js:67-69`, `lib/db.js:5` |
| BD-06 | Sin pool de conexiones: cada request abre y cierra una conexión, y el dashboard consulta cada 3 a 10 s (DT-33). | `lib/db.js` |
| BD-07 | Estados y perfiles como literales dentro del SQL (1, 2…). Ver DT-08 para la parte JS. | `solicitudes:38`, `guardian:41,56,88,89,133`, `viajes:107,190`, `chats:42`, `recibidas:34`, `admin/viajes:22`, `admin/usuarios:52` |
| BD-08 | IDs pasados como string sin `Number()`. | `solicitudes:41`, `guardian:91,168`, `mensajes:32,97`, `admin/*` |
| BD-09 | Falta `ORDER BY` en el listado de viajes; `ROWNUM = 1` sin orden. | `admin/viajes/route.js:13-28`, `guardian/route.js:41, 184`, `admin/viajes:93` |
| BD-10 | Inserts en bucle, uno por fila (N+1): permisos por menú al registrar y permisos por usuario al crear un menú. Candidatos a `executeMany` o `INSERT … SELECT`. | `auth/register/route.js:35-44`, `admin/tablas/route.js:199-210` |
| BD-11 | Listados sin paginación ni límite: `SELECT *` de cualquier tabla, búsqueda de viajes, todos los permisos, historial completo del chat en cada poll. | `admin/tablas:113`, `viajes:90-108`, `admin/permisos:45-52`, `mensajes:44-50` |
| BD-12 | La misma query de participantes de una solicitud está escrita tres veces. | `mensajes/route.js:26-31, 91-96`, `lib/auth/ownershipQueries.js:8-13` |
| BD-13 | Bloques de `JOIN` repetidos casi iguales (viaje + municipios origen/destino + vehículo + marca + conductor) en 6 queries. Candidato a vista. | `guardian:30-57, 68-90`, `viajes:90-108`, `mis-rutas:26-61`, `chats:28-45`, `recibidas:24-36` |
| BD-14 | Funciones sobre columnas en el `WHERE` (`UPPER`, `LOWER`, `SUBSTR`), que impiden usar índices comunes. | `auth/login:43`, `guardian:56,122,183`, `viajes:17,48,57,116,125`, `admin/viajes:92` |
| BD-15 | Metadatos de columnas sin `ORDER BY column_id`: el orden de columnas del panel admin no está garantizado (F31 depende de esto). | `admin/tablas/route.js:47-51` |
| BD-16 | Subconsultas correlacionadas por fila (`COUNT`, `LISTAGG`, nombre del pasajero). | `admin/conductores:22-23`, `admin/viajes:19-22`, `guardian:37-43` |
| BD-17 | Los mensajes se guardan por par de usuarios y no por solicitud (F4): falta la FK al chat. | `mensajes/route.js:44-50, 114-117` |
| BD-18 | `getOrCreateMunicipio` y `getOrCreateMarca` hacen 2 a 4 queries secuenciales por publicación, con búsqueda por nombre sin normalizar acentos. | `viajes/route.js:7-76` |
| BD-19 | El chat abierto pide el historial completo cada 3 s (20 req/min; ~62 KB/min con 40 mensajes, ver `docs/PERFORMANCE.md`). Pedir solo los mensajes nuevos requiere una query con filtro por ID o fecha (DT-33). | `mensajes/route.js` (GET), `dashboard/page.jsx:451-478` |

## Dependencias entre ítems

- DT-01 → DT-02 → DT-34 → DT-35 (tests antes de tocar el dashboard).
- DT-03 + DT-04 resuelven casi todo DT-05 y facilitan DT-06.
- DT-38 → DT-19 (el lint tiene que pasar antes de exigirlo en CI).
- Rollout de auth → DT-36, DT-44.
- Habilitar la BD → DT-37, DT-47 y todo `bd-pendiente`.
- No se detectaron dependencias circulares: `lib/auth` es lineal (`session` ← `guard` ← `ownership`) y `lib/client` también (`sessionFetch` ← `logout`).

## Historial: ítems cerrados

- [x] `seguridad` Auth en servidor (cookie firmada + guard + proxy) detrás de `AUTH_ENFORCED` (2026-09-28). Ver BUGS S1–S3.
- [x] `tests` Caracterización de los route handlers mockeando `@/lib/db` (2026-09-28).
- [x] `seguridad` F11: DELETE sobre PK compuesta en `admin/tablas` (2026-09-28).
- [x] `seguridad` IDOR (S6), detrás de `AUTH_ENFORCED` (2026-09-29). Decisiones: un ID ajeno responde 403; el admin saltea la pertenencia; el conductor acepta o rechaza, el pasajero cancela y "Pendiente" no se asigna por API; SELECTs nuevos de solo lectura sin tocar queries existentes.
- [x] `feat` Redirección ante 401 con `fetchConSesion` en dashboard, `/admin` y `PermisosManager` (2026-09-29).
- [x] `fix` F27: el panel admin se rompía ante respuestas de error (2026-09-29).
- [x] `feat` Botón de logout en `/admin` (2026-09-30).
- [x] `tooling` `.gitattributes` con `eol=lf` (2026-09-30).
