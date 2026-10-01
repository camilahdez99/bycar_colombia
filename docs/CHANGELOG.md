# Changelog

## 2026-10-01 — Fixes de frontend F33, F35, F36, F37 y cobertura en el repo (DT-49)

Rama `fix/frontend-bugs` (worktree `../bycar_colombia-frontend`, desde `f9085de`), en paralelo con otras sesiones: la API y `lib/` del servidor quedan a cargo de la rama `mejoras/backlog-pendiente`. Un commit por cambio.

**Qué cambió**
- DT-49: `@vitest/coverage-v8@5.0.2` como devDependency, script `npm run test:coverage` y configuración de cobertura en `vitest.config.mjs`. `npm test` no cambia. El lockfile subió por dedupe cuatro paquetes `@babel/*` transitivos (de lint y del provider) a 7.29.x; el lint da el mismo resultado.
- F33: el login borra el usuario de `localStorage` cuando la respuesta no trae `user` (login del admin).
- F35: la pre-alerta del guardián sale con 300 s o menos restantes, no solo al pasar justo por 300.
- F36: "Sí, he llegado" cierra el modal de pre-alerta; sin `id` del guardián se avisa que la llegada no quedó registrada.
- F37: "Solicitud aceptada" / "Solicitud rechazada".
- Bug nuevo **F38** 🟡: finalizar y extender el guardián no revisan la respuesta del `PUT`.

**Cambios de comportamiento a propósito**
- Los cuatro fixes. En cada uno, el test que fijaba el comportamiento anterior se invirtió y se verificó que falla con el código previo. Se sumaron tests de regresión: login de usuario y credenciales inválidas no pierden el usuario, la pre-alerta vuelve a salir tras extender el tiempo y en un guardián nuevo.

**Tests corridos (antes de cada commit)**
- `npm test`: de 729 a 734 tests, 47 archivos, todos OK. Se corrió con `--maxWorkers=2` porque otras sesiones corrían suites en la misma máquina y los tests de jsdom daban timeout por CPU (con menos carga pasan con la configuración por defecto).
- `npm run test:coverage`: OK, 96,8 % de sentencias.
- `npm run build`: OK.
- `npm run lint`: 5 errores y 3 warnings, igual que la línea base.

**Riesgos pendientes**
- Integración: esta rama toca `app/dashboard/page.jsx`, que la sesión de reorganización (DT-34) está dividiendo, y `package.json`/`package-lock.json`, que la sesión de dependencias actualiza (vitest 5.0.3). Quien integre segundo rebasa y regenera el lockfile con `npm install`, y sube `@vitest/coverage-v8` a la misma versión que `vitest`.
- F38 sigue abierto.
## 2026-10-01 — Auditoría de dependencias y S5

Rama `chore/deps-seguridad` (worktree `../bycar_colombia-deps`). Un commit por dependencia, con la suite completa después de cada uno.

**Auditoría inicial (`npm audit`)**: 9 vulnerabilidades: 1 crítica (`next`), 5 altas (`brace-expansion`, `browserslist`, `js-yaml`, `postcss` y `sharp`, estos dos anidados en `next`), 2 moderadas (`@humanfs/node`, `baseline-browser-mapping`) y 1 baja (`@babel/core`). Ninguna requería una major. **Después: 0.**

**Qué cambió**
- `next` 16.2.4 → 16.3.8 y `eslint-config-next` → 16.3.8.
- `npm audit fix`: solo lockfile, 28 transitivas. `oracledb` no cambió.
- Patch/minor: `vitest` 5.0.3, `tailwindcss` y `@tailwindcss/postcss` 4.3.3, `lucide-react` 1.49.0, `react-hot-toast` 2.6.1, `eslint` 9.39.5.
- Tailwind: se comparó el CSS compilado antes y después. Cambia el stack por defecto de `--font-sans` (lo pisa Inter vía `next/font`), se simplifican `calc()` equivalentes y desaparece `.start`, que no se usa. Sin cambio visual esperado.
- S5: el login lee el admin de `ADMIN_EMAIL` / `ADMIN_PASSWORD` (`lib/auth/adminCredentials.js`, comparación en tiempo constante). Nuevo `.env.example` sin valores, desexcluido en `.gitignore`. README y `ROLLOUT_AUTH.md` actualizados.

**Cambio de comportamiento a propósito**
- Sin `ADMIN_EMAIL` / `ADMIN_PASSWORD`, `admin@bycar.co` / `admin` ya no entra como admin: el login sigue por la BD.

**Tests corridos**
- `npm test`: 745 tests en 49 archivos, todos OK (7 nuevos). Con la máquina cargada, `--maxWorkers=2` evita timeouts al arrancar workers; no son fallas de tests.
- `npm run build`: OK en cada commit.
- `npm run lint`: 5 errores y 5 warnings. Los 2 warnings nuevos vienen de una regla nueva de `eslint-config-next` (DT-51); no hay errores nuevos.

**Riesgos pendientes**
- **Antes del próximo deploy hay que configurar `ADMIN_EMAIL` y `ADMIN_PASSWORD`**; si no, el admin pierde el acceso.
- La fila `admin@bycar.co` / `admin` del seed puede existir en `USUARIOS` (S5): cambiar esa contraseña.
- S7 y S9 (credenciales de Oracle) siguen siendo tarea de una persona: rotar y limpiar el historial.
- Al integrar con `fix/frontend-bugs` (DT-49) va a chocar el lockfile: regenerarlo y subir `@vitest/coverage-v8` a 5.0.3, igual que `vitest`.
- Postergado: `eslint` 10 y `oracledb` 7 (DT-50).

## 2026-10-01 — Fix F34: municipio sin nombre en el autocompletado

Rama `refactor/deuda-bloque-3`, en un commit propio (`fix`), separado de la caracterización.

**Qué cambió**
- `lib/client/formato.js`: nuevo `nombreDeOpcion(opcion)`, que devuelve el string tal cual, el `nombre` de un municipio, o `''` si no tiene.
- `app/dashboard/page.jsx`: el `Autocomplete` usa `nombreDeOpcion` para filtrar, mostrar y seleccionar, en lugar de `m.nombre || m`.

**Cambio de comportamiento a propósito**
- Un municipio sin nombre ya no rompe el dashboard: no aparece en las sugerencias. Con nombres válidos el resultado es el mismo que antes.
- El test de `dashboard-navegacion.test.jsx` que fijaba el error se reemplazó por el comportamiento esperado, y se verificó que falla con el código anterior.

**Tests corridos**
- `npm test`: 729 tests, 47 archivos, todos OK (7 nuevos de `nombreDeOpcion`).
- `npm run build`: OK.
- `npm run lint`: 5 errores y 3 warnings, igual que la línea base.

**Riesgos pendientes**
- Sigue sin saberse si en producción hay municipios sin nombre. El fix evita la caída pero no corrige el dato; si existen, conviene revisarlos cuando se habilite trabajar la BD.

## 2026-09-30 — Tests de caracterización de módulos críticos

Rama `refactor/deuda-bloque-3`. Solo se agregaron tests: no se tocó código de producción. Un commit por módulo (`test(caracterizacion): …`). La BD se mockea siempre (`oracledb` o `fetch`); ningún test abre una conexión real.

**Qué cambió**
- `lib/db`: configuración del driver, una conexión por llamada con las variables de entorno del momento, y log de error sin credenciales.
- `login` y `register`: validación, cuerpo enviado, `localStorage`, redirección, mensajes y estado del botón.
- `dashboard` (7 archivos + `__tests__/helpers/dashboard.js`): publicar viaje (valor, puestos, marca), buscar y solicitar cupo, aceptar o rechazar solicitudes, chat, guardián (temporizador con reloj falso, pre-alerta, extensión, alerta, retomar al recargar), menú según permisos y refresco periódico cada 10 s. Cierra DT-01.
- `PermisosManager`: submenús de Inicio, errores de carga y de asignación o revocación.
- Bugs nuevos fijados por test: **F33** (el login del admin deja el usuario anterior en `localStorage`), **F34** (un municipio sin nombre rompe el autocompletado), **F35** (sin pre-alerta si el guardián dura 5 min o menos), **F36**, **F37**. Quedaron fijados también F1, F9, F28, F29 y F30, que antes no tenían test.
- Backlog: DT-01 ✅ y DT-49 nuevo (sumar `@vitest/coverage-v8` al repo, requiere confirmación).

**Cobertura (sentencias / ramas)**

Medida con `@vitest/coverage-v8@5.0.2` instalado en un clon temporal fuera del repo (sin tocar `package.json` ni `node_modules`), sobre `app/`, `lib/`, `components/` y `proxy.js`, sin contar `app/layout.js`.

| | Antes | Después |
|---|---|---|
| Total | 82,87 % / 75,22 % | 96,81 % / 93,25 % |
| `app/dashboard/page.jsx` | 53,5 % / 42,1 % | 95,2 % / 91,0 % |
| `app/login/page.jsx` | 0 % | 100 % |
| `app/register/page.jsx` | 0 % | 100 % |
| `lib/db.js` | 0 % | 100 % |
| `app/components/admin/PermisosManager.jsx` | 84,2 % / 69,0 % | 98,2 % / 93,1 % |

**Tests corridos (antes de cada commit)**
- `npm test`: de 609 a 722 tests (37 → 47 archivos), todos OK. Los archivos con temporizadores se corrieron 8 veces seguidas sin fallos (hubo dos carreras en los tests que se corrigieron antes de commitear).
- `npm run build`: OK.
- `npm run lint`: 5 errores y 3 warnings, igual que la línea base; los archivos nuevos no tienen errores.

**Riesgos pendientes**
- Sin cubrir: la landing (`app/page.jsx`, 58 %: contador animado y scroll del nav, sin lógica de negocio) y, en el dashboard, los `catch` de los refrescos (solo loguean) y los estilos de hover y el focus/blur del autocompletado.
- Los tests del dashboard dependen de textos y emojis de la UI: un cambio de copy los rompe a propósito, porque fijan lo que ve el usuario.
- F34 puede romper el dashboard en producción si en `MUNICIPIOS` hay un registro sin nombre. Conviene revisarlo (consulta de solo lectura) antes de priorizar el fix.

## 2026-09-30 — DT-11, CI y deuda técnica bloque 3 (riesgo bajo · impacto bajo)

Rama `refactor/deuda-bloque-3`, creada sobre `refactor/deuda-bloque-2`. Un commit por cambio lógico.

**Qué cambió**
- DT-11 (acordado): el dashboard cierra sesión con `lib/client/logout.js`, así que pasa de `router.push('/')` a una navegación completa. Tiene un test nuevo.
- DT-19: `.github/workflows/ci.yml` con tests, build y lint informativo, en Node 24.
- DT-20 a DT-23 (borrados acordados): `FormularioConductor`, `FormularioVehiculo`, `lib/municipios.js` y su test, los 5 SVG de plantilla y `scripts/create_admin_user.js` (cierra F32).
- DT-24, DT-25: fuera `tailwind.config.js`, `daisyui` y `geist`. El CSS compilado es idéntico byte a byte antes y después, y el lockfile solo pierde esas dos entradas.
- DT-27: `scripts/README.md`.
- Reclasificados con su motivo en el backlog: DT-26 (tipografías, pasa a riesgo medio), DT-28 (imagen externa, a decidir), DT-29 y DT-30 (`bd-pendiente` y bug).
- Bug nuevo **S9** 🔴: `scripts/diagrama.txt` tiene en texto plano las contraseñas de SYSTEM y de `US_BYCAR`, y está versionado.

**Tests corridos (antes de cada commit)**
- `npm test`: 609 tests, 37 archivos, todos OK. Bajó de 612 a 609 porque se borraron los tests de `lib/municipios.js`.
- `npm run build`: OK.
- `npm run lint`: 5 errores y 3 warnings, igual que la línea base.

**Riesgos pendientes**
- S9: rotar las contraseñas de SYSTEM y `US_BYCAR` y sacarlas del historial de git. Lo tiene que hacer una persona.
- El repo local no comparte historia con `github.com/camilahdez99/bycar_colombia` (`main` remoto en `736903d`). Antes de pushear hay que decidir cómo unirlos. El CI recién va a correr cuando esté en GitHub.

## 2026-09-30 — Deuda técnica, bloque 2 (riesgo bajo · impacto medio)

Rama `refactor/deuda-bloque-2`, creada sobre `refactor/deuda-bloque-1`. Un commit por cambio lógico.

**Qué cambió**
- DT-01: tests de caracterización de `DynamicForm` y del CRUD del panel admin (alta, edición, baja y errores, incluido E6).
- DT-10: código muerto menor fuera: `useCallback`, `pId`, el estado `guardianFinalizado`, un comentario duplicado, un `setState` anidado en el updater de `setMensajes`, el import `toast` y la prop `table` de `DynamicForm`, el `req` sin uso en catálogos.
- DT-16: `admin/tablas` usa una sola función de clave primaria.
- DT-14, DT-15: el CRUD admin pasa por una única `ejecutarMutacion`, con los mismos textos. La `key` de respaldo de las filas deja de ser `Math.random()`.
- DT-08, DT-09: `lib/domain/constantes.js` (estados de solicitud, perfil, menú Inicio, tiempo del guardián) y constantes de refresco y del guardián en el dashboard. El SQL no se tocó.
- DT-13: el dashboard deja de pedir `mis-rutas` y `chats` dos veces al cargar, así que son 2 requests y 2 conexiones a Oracle menos por carga.
- DT-12: caché HTTP opcional de los catálogos con el flag `CATALOG_CACHE_SECONDS`, apagado por defecto.
- DT-17, DT-18: README propio del proyecto y la excepción de login/register a `fetchConSesion` documentada.

**Cambios de comportamiento a propósito**
- DT-13: se pide cada URL una sola vez al cargar el dashboard. El test de carga se actualizó para exigirlo, y se verificó que falla con el código anterior.
- DT-12: solo si se configura el flag.

**Tests corridos (antes de cada commit)**
- `npm test`: de 571 a 611 tests, 37 archivos, todos OK.
- `npm run build`: OK.
- `npm run lint`: 5 errores y 3 warnings, igual que la línea base.

**Riesgos pendientes**
- DT-11 (logout del dashboard) no se hizo: pasar a `lib/client/logout.js` cambia `router.push('/')` por una navegación completa.
- DT-19 (CI) no se hizo: el repositorio no tiene remoto configurado, así que falta definir dónde correría.

## 2026-09-30 — Deuda técnica, bloque 1 (riesgo bajo · impacto alto)

Rama `refactor/deuda-bloque-1`, un commit por cambio lógico.

**Qué cambió**
- DT-01 (parcial): 8 tests de caracterización del dashboard a través de la UI (formato de valor, mayúsculas, autocompletado, temporizador, badges, ID de usuario, incluido el `|| 1` de F1).
- DT-02: `normalizar`, `formatTiempo`, `formatCurrency`, `getUserId` y `getBadgeCount` salieron del dashboard a `lib/client/`, con tests unitarios. La expresión del ID de usuario estaba copiada 8 veces.
- DT-03 (parcial), DT-04, DT-05: `lib/log.js` (logs en una línea JSON) y `lib/api/connection.js` (`closeConnection`). Los 59 `console.*` del servidor pasaron al logger, y no quedan `catch` vacíos en `app/` ni `lib/`. `tablas` y `guardian` conservan su cierre sin proteger: cambiarlo sería corregir E2.
- DT-07 (parcial): reglas de solicitudes, limpieza de datos de viaje y cálculo del receptor en `lib/domain/`, con tests.
- Docs: `ARCHITECTURE.md` (módulos nuevos, sección de logs), `CLAUDE.md` (convenciones de logs, cierre y `lib/domain`), `BACKLOG.md` (estado de cada ítem).

**Sin cambio de comportamiento:** respuestas, códigos HTTP, SQL (los snapshots no cambiaron) y requests del frontend. Lo único que cambia es el formato de los logs del servidor.

**Tests corridos (antes de cada commit)**
- `npm test`: de 520 a 571 tests, 35 archivos, todos OK.
- `npm run build`: OK.
- `npm run lint`: 5 errores y 3 warnings, igual que la línea base.

**Riesgos pendientes**
- Quien lea los logs en producción (alertas, grep) tiene que adaptarse al formato JSON nuevo: `event: 'api_error'` y `route`.
- DT-06 (no exponer `error.message`) queda sin hacer: cambia el body de error y corrige S8, así que va en tarea aparte.

## 2026-09-30 — Relevamiento de deuda técnica

**Qué cambió**
- `docs/BACKLOG.md` reescrito: 48 ítems de deuda (`DT-01` a `DT-48`) con categoría, riesgo, impacto, esfuerzo y archivos, ordenados de riesgo bajo + impacto alto en adelante; 18 ítems `bd-pendiente` sin priorizar (`BD-01` a `BD-18`). Los ítems abiertos del backlog anterior quedaron integrados y los cerrados pasaron al historial.
- `docs/BUGS.md`: bugs nuevos F28 a F32 y E6, encontrados durante la lectura. No se corrigió ninguno.
- No se modificó código, tests ni configuración.

**Tests corridos**
- Ninguno: el cambio es solo de documentación.

**Riesgos pendientes**
- Las referencias de línea de `BUGS.md` anteriores al 2026-09-30 quedaron corridas por los cambios de auth (por ejemplo, F1 apunta a `:547,569` y hoy es `:548,570`). No se actualizaron en esta tarea.
- DT-24 y DT-25 (`tailwind.config.js`, `daisyui`, `geist` sin uso) se dedujeron por lectura; falta confirmarlo con un build antes de tocar nada.
- F28 afecta a la función de seguridad del producto (el guardián) y conviene evaluarlo pronto.

## 2026-09-30 — Cierre de la etapa "base de trabajo + seguridad de acceso"

**Qué cambió (últimos dos ítems)**
- Botón "Cerrar sesión" en `/admin`, con `lib/client/logout.js`: llama al endpoint, limpia el usuario local y vuelve al inicio aunque falle la red.
- `.gitattributes` con `* text=auto eol=lf`. La renormalización no modificó ningún archivo y un clon nuevo queda con 0 archivos en CRLF.

**Tests corridos**
- `npm test`: 31 archivos, 520 tests OK. `npm run build`: OK. `npm run lint`: 5 errores y 3 warnings, igual que la línea base.

**Estado al cierre de la etapa**
- Hecho:
  - repo propio y suite de tests (de 0 a 520);
  - caracterización de las 17 rutas de la API y de la carga del dashboard y del panel admin;
  - fixes F11 y F27;
  - autenticación, roles y pertenencia de recursos (S1, S2, S3 y S6), detrás de `AUTH_ENFORCED`;
  - redirección ante 401 y logout en dashboard y admin;
  - runbook de rollout y verificador de consultas.
- **Pendiente, a cargo del equipo:** ejecutar `docs/ROLLOUT_AUTH.md`. Hasta prender el flag, producción sigue sin autenticación.
- Pendiente para próximas etapas (ver `BACKLOG.md`):
  - S4 (contraseñas en texto plano) y S5 (admin hardcodeado), que requieren trabajar la BD;
  - los errores de lint de la línea base;
  - el refactor del dashboard;
  - los ítems `bd-pendiente`;
  - los bugs funcionales F1–F26 que siguen abiertos.

**Riesgos pendientes**
- Las consultas de pertenencia no se probaron contra Oracle real (paso 1.3 del runbook).
- Los tests usan una BD simulada: no validan la semántica real de Oracle.

## 2026-09-29 — Preparación del rollout de auth

**Qué cambió**
- `lib/auth/guard.js`: si `AUTH_ENFORCED=true` y falta `SESSION_SECRET`, se registra `auth_misconfigured` una vez por proceso. Sigue fallando cerrado (401): no desactiva la seguridad.
- `scripts/verificar-consultas-auth.mjs`: corre las consultas de pertenencia contra un Oracle de prueba en una transacción `READ ONLY` que termina con rollback. Lee las credenciales solo de variables de entorno.
- `docs/ROLLOUT_AUTH.md`: runbook con precondiciones, prueba en staging, las dos fases en producción, verificación, monitoreo y rollback.

**Tests corridos**
- Test nuevo para `auth_misconfigured`: 401 y un único log. `npm test`: 517 OK. `npm run build`: OK.
- Script: probado sin variables (exit 2 con mensaje) y contra una BD inalcanzable con valores ficticios (exit 1 sin exponer datos). **No se corrió contra Oracle real:** no hay credenciales de prueba disponibles y la regla 7 impide usarlas.

**Riesgos pendientes**
- El rollout en sí (secreto, despliegue y flag) queda en manos del equipo, siguiendo el runbook.

## 2026-09-29 — IDOR (S6): pertenencia de recursos, detrás de `AUTH_ENFORCED`

**Qué cambió**
- `lib/auth/ownership.js`: `checkOwnership` y `requireSelf`. Si el recurso no es del usuario responden 403. El admin saltea el chequeo y con el flag apagado no hacen nada.
- **Fase A (sin SQL nuevo), 8 handlers:** `usuarioId` en query o body igual al de la sesión. En `mensajes`, además, ser participante del chat, usando la query que ya existía.
- **Fase B (SELECTs nuevos de solo lectura, autorizados), 4 handlers:**
  - `PUT solicitudes`: roles por estado.
  - `POST` y `PUT guardian`: participar del viaje.
  - `GET guardian?email`: el correo es el propio.
- Verifiqué que los datos que manda el dashboard cumplen todas las reglas: solo ofrece guardián en viajes aceptados, y usa su propio ID y correo.

**Tests corridos**
- Unitarios del helper (18) y de las consultas (15, con 4 snapshots de SQL nuevo).
- `idor.test.js` (43): para cada ruta, el dueño pasa y otro usuario recibe 403 **sin que se ejecute ninguna escritura**. También verifica que cada handler de usuario tenga una regla declarada.
- `auth-enforcement.test.js` se ajustó a propósito: en las rutas de usuario verifica "no 401", porque el 403 ahora corresponde a la pertenencia.
- `npm test`: 30 archivos, 516 tests OK. Los snapshots de caracterización no cambiaron: con el flag apagado no se ejecuta ninguna consulta nueva.
- `npm run build`: OK. `npm run lint`: igual que la línea base.

**Riesgos pendientes**
- No se probó contra Oracle real. Las consultas nuevas usan binds con nombre repetido (`:userId` dos veces), que `oracledb` soporta. Conviene correrlas en un entorno de prueba antes de prender el flag.
- Un 403 por pertenencia no redirige al login. Si alguna vez el usuario del navegador no coincide con el de la cookie, el dashboard muestra errores en vez de pedir que se loguee de nuevo.
- F3 sigue abierto: un usuario puede publicar un viaje con la placa de un vehículo ajeno. Es una regla de negocio, no un IDOR de IDs de usuario.

## 2026-09-29 — Fix F27: panel admin ante errores de la API

**Qué cambió**
- `app/admin/page.jsx`: la lista de tablas y la metadata se leen con `readList`, que exige `res.ok` y un array. Si no se cumple, se muestra el toast de error que ya existía en lugar de guardar `{ error }` como lista.
- Si falla la carga de una tabla, se vacían columnas y filas. Antes quedaban las de la tabla anterior bajo el nombre de la nueva, y un "Eliminar" podía mandar un id de una tabla a otra.

**Tests corridos**
- 3 tests nuevos, escritos antes del fix y fallando con el código viejo: falla la lista, falla la metadata al cambiar de tabla, y "Nuevo" con la metadata caída.
- `admin-sesion.test.jsx` se actualizó a propósito: ya no fija el crash, verifica que no ocurra.
- `npm test`: 27 archivos, 440 tests OK. `npm run build`: OK. `npm run lint`: igual que la línea base.

**Riesgos pendientes**
- Si falla la lista de tablas, el panel queda con "Cargando datos..." indefinidamente, igual que antes cuando no había tablas. Es cosmético.

## 2026-09-29 — /admin: redirección ante 401

**Qué cambió**
- `app/admin/page.jsx` (7 llamadas) y `PermisosManager.jsx` (4) usan `fetchConSesion`.
- Fix del wrapper: ahora pasa a `fetch` exactamente los mismos argumentos. Antes agregaba un `init` `undefined`; lo detectó la caracterización nueva.

**Tests corridos**
- Antes del cambio, caracterización de la carga del panel y de `PermisosManager` (consultar, asignar y revocar). Pasa igual antes y después.
- Test de integración: el panel con la API respondiendo 401 redirige una sola vez.
- `npm test`: 27 archivos, 437 tests OK y sin errores no manejados. `npm run build`: OK. `npm run lint`: igual que la línea base.

**Riesgos pendientes**
- F27 (nuevo): con un 401 el panel admin igual redirige, pero antes se rompe el render y la pantalla queda en blanco por un instante. Con un 500 queda en blanco sin redirigir. Corrección en tarea aparte.

## 2026-09-29 — Dashboard: redirección ante 401

**Qué cambió**
- `lib/client/sessionFetch.js`: wrapper de `fetch`. Ante un 401 limpia el usuario local y navega a `/login`, una sola vez aunque fallen varias llamadas en paralelo. Devuelve la respuesta sin tocarla.
- `app/dashboard/page.jsx`: sus 24 llamadas usan `fetchConSesion`. No hubo otros cambios.

**Tests corridos**
- Antes del cambio, nueva caracterización de la carga inicial del dashboard: qué endpoints llama con y sin usuario. Pasa igual antes y después.
- Tests unitarios del wrapper (9) y test de integración: el dashboard con la API respondiendo 401 redirige una sola vez.
- `npm test`: 25 archivos, 431 tests OK. `npm run build`: OK. `npm run lint`: 5 errores y 3 warnings, igual que la línea base.

**Riesgos pendientes**
- `/admin` todavía no redirige ante un 401 (ver `BACKLOG.md`).
- Con el flag apagado la API nunca devuelve 401 al dashboard, así que el cambio no tiene efecto hasta prender `AUTH_ENFORCED`.

## 2026-09-28 — Autenticación (detrás de flag) y fix F11

**Qué cambió**
- **F11 corregido:** `admin/tablas` responde 400 en PUT y DELETE cuando la tabla tiene PK compuesta. Antes borraba o modificaba todos los permisos del usuario. El texto del SQL no cambió.
- **Auth en el servidor** detrás de `AUTH_ENFORCED`, apagado por defecto:
  - cookie de sesión firmada (`jose`, nueva dependencia);
  - guard en los 33 handlers de usuario y admin;
  - `POST /api/auth/logout`;
  - `proxy.js` para `/admin` y `/dashboard`.
- El login emite la cookie solo si existe `SESSION_SECRET`. El body de la respuesta no cambia.
- El logout del dashboard ahora llama al endpoint antes de limpiar `localStorage`.

**Tests corridos**
- `npm test`: 22 archivos, 419 tests OK. Los 263 de caracterización siguen intactos: con el flag apagado, la API responde igual que antes.
- `auth-enforcement.test.js` recorre los 36 handlers: 401 sin sesión, 403 sin rol, y catálogos públicos.
- `npm run build`: OK, con el proxy detectado.
- `npm run lint`: 5 errores y 3 warnings, igual que la línea base.
- Prueba de humo con `next start` y `AUTH_ENFORCED=true`: redirecciones, 401, login con cookie, `/admin` y logout, todo OK.

**Riesgos pendientes**
- Mientras el flag esté apagado, S1-S3 siguen abiertos en producción. Ver los pasos de rollout en `BACKLOG.md`.
- Con el flag prendido, los usuarios logueados antes del despliegue reciben 401 hasta que vuelvan a loguearse. El dashboard todavía no redirige ante un 401.
- La cookie es `Secure` en producción: si producción no usa HTTPS, nadie podría autenticarse.
- IDOR (S6) sigue abierto: un usuario con sesión puede operar sobre IDs ajenos.

## 2026-09-28 — Caracterización de la API

**Qué cambió**
- Tests de caracterización para las 17 rutas de `app/api/`, sin tocar código de producción. Son 254 tests nuevos (262 en total).
- `__tests__/helpers/api.js`: conexión Oracle falsa que registra cada `execute`. Los snapshots fijan el texto exacto del SQL, los binds y las opciones. Cambiar una query rompe el test (regla 8).
- Los comportamientos dudosos se fijaron tal cual, con "comportamiento actual" en el nombre del test, y se documentaron en `BUGS.md` (F11-F26, E4-E5).

**Tests corridos**
- `npm test`: 18 archivos, 262 tests, todo OK.
- `npm run build`: OK.

**Riesgos pendientes**
- F11 (🔴): DELETE en `admin/tablas` sobre PK compuesta borra de más. Sumado a S2 (sin auth), cualquiera puede borrar permisos masivamente.
- Los tests usan una BD simulada. No validan la semántica real de Oracle (commit al cerrar, tipos). Para eso harían falta tests de integración contra una BD de prueba.
- Los tests fijan comportamiento con bugs: al corregir cada bug hay que actualizar el test correspondiente a propósito.

## 2026-09-28 — Fase 0: base de trabajo

**Qué cambió**
- Repositorio git propio en el proyecto (antes el repo era toda la carpeta de usuario). El commit inicial es el código tal como estaba.
- `scripts/fix_guardian.js` excluido localmente de git porque tiene credenciales hardcodeadas. El archivo no se modificó.
- Vitest + jsdom + Testing Library. Scripts `npm test` y `npm run test:watch`. Config en `vitest.config.mjs` (alias `@/`, pool `threads`).
- Tests de caracterización de humo: `lib/municipios` y la landing (`app/page.jsx`).
- `CLAUDE.md` con las reglas del proyecto y los comandos.
- Documentación inicial: `ARCHITECTURE.md`, `BUGS.md`, `BACKLOG.md`.

**Tests corridos**
- `npm test`: 2 archivos, 8 tests, todos OK.
- `npm run build`: OK.
- `npm run lint`: falla, igual que en la línea base (5 errores y 3 warnings previos; ninguno nuevo).

**Riesgos pendientes**
- Seguridad crítica: la API no tiene autenticación y las contraseñas están en texto plano (BUGS S1-S4).
- Dependencia transitiva: `postcss` pasó de 8.5.9 a 8.5.28 porque Vite lo exige. Afecta solo al pipeline de Tailwind; el build pasa.
- Cobertura de tests mínima: los route handlers y el dashboard todavía no tienen caracterización.
