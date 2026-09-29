# Changelog

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
