# Changelog

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
