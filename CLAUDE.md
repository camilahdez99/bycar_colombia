@AGENTS.md

# CLAUDE.md — Reglas del proyecto

Leé este archivo completo antes de cualquier tarea. Estas reglas tienen prioridad sobre cualquier otra instrucción implícita.

## Contexto

- Sistema en producción. Objetivo: organizar, optimizar y extender SIN cambiar comportamiento funcional.
- La base de datos está FUERA de alcance por ahora: no se modifica esquema, queries de escritura, conexiones ni drivers.
- Documentación viva: `docs/ARCHITECTURE.md`, `docs/BACKLOG.md`, `docs/BUGS.md`, `docs/CHANGELOG.md`.

## Reglas de oro

1. No cambiar comportamiento salvo que la tarea lo pida explícitamente. Si un refactor altera un resultado, es un bug.
2. Tests primero. Antes de modificar un módulo, verificá que tenga tests de caracterización. Si no tiene, escribilos primero y confirmá que pasan con el código actual.
3. Un cambio lógico por commit. Mensajes en español, formato: `tipo(alcance): descripción` (tipos: refactor, fix, feat, test, docs, perf, chore).
4. Correr la suite completa antes de cada commit. Si algo falla, no commitear: revertir o arreglar.
5. Bugs encontrados → `docs/BUGS.md`, NO se corrigen dentro de un refactor. Se corrigen en tarea aparte.
6. Preguntar antes de: borrar archivos, eliminar o actualizar dependencias, cambiar firmas públicas / endpoints / contratos de API.
7. Nunca tocar credenciales, `.env*` ni config de producción.
8. Base de datos: no modificar esquema, no ejecutar INSERT/UPDATE/DELETE/DDL, no cambiar el texto de las queries existentes. Si ves problemas en SQL, anotalos en `docs/BACKLOG.md` con categoría `bd-pendiente`.
9. Si una tarea es grande, dividirla y proponer el plan antes de ejecutar.
10. Al terminar cada tarea: resumen corto de qué cambió, qué tests se corrieron y riesgos pendientes. Registrarlo en `docs/CHANGELOG.md`.

## Estándares de código

- Nombres descriptivos, funciones cortas con una sola responsabilidad.
- Sin código comentado ni muerto: si no se usa, se elimina (previa confirmación).
- Manejo de errores explícito; nada de `catch` vacíos.
- Logs estructurados, sin datos sensibles (contraseñas, tokens, documentos de identidad). En el servidor, con `logError` / `logInfo` de `lib/log.js`; nada de `console.*` sueltos.
- En los route handlers, cerrar la conexión con `closeConnection(connection, 'MÉTODO /api/ruta')` de `lib/api/connection.js`.
- Lógica de negocio pura en `lib/domain/`, con tests propios; los handlers solo orquestan.
- Features nuevas detrás de feature flags, apagadas por defecto.

## Stack

Next.js 16 (App Router, JavaScript) · React 19 · Tailwind 4 + daisyUI · Oracle vía `oracledb` (`lib/db.js`) · Vitest + Testing Library.

## Comandos

- Instalar dependencias: `npm ci`
- Tests: `npm test` (modo watch: `npm run test:watch`)
- Lint: `npm run lint` — ⚠️ falla en la línea base (ver `docs/BACKLOG.md`); verificar que no aparezcan errores NUEVOS
- Build: `npm run build`
- Levantar local: `npm run dev` (requiere `DB_USER`, `DB_PASSWORD`, `DB_CONNECTION_STRING` en `.env.local`)

## Feature flags y variables de auth

- `SESSION_SECRET`: secreto de la cookie de sesión (≥ 32 caracteres). Sin él, el login no emite cookie.
- `AUTH_ENFORCED`: con `true`, la API exige sesión y rol (ver `docs/ARCHITECTURE.md`). Apagado por defecto.
- `CATALOG_CACHE_SECONDS`: entero positivo = segundos de `Cache-Control` en `menus`, `marcas` y `municipios`. Apagado por defecto (sin header). Con caché, un menú nuevo tarda ese tiempo en verse.
- Toda ruta nueva de `app/api` debe llamar a `authorize(req, …)` y figurar en `__tests__/app/api/auth-enforcement.test.js`.
- Toda ruta de usuario que reciba IDs debe validar la pertenencia (`requireSelf` o `checkOwnership` de `lib/auth/ownership.js`) y declarar su regla en `COBERTURA` de `__tests__/app/api/idor.test.js`.
- Todo `fetch` del frontend a la API debe usar `fetchConSesion` (`lib/client/sessionFetch.js`).

Suite completa antes de commitear: `npm test` + `npm run build` + lint sin errores nuevos.

## Notas de entorno

- Vitest usa `pool: 'threads'`; el pool `forks` no inicia en entornos con IPC restringido.
- Los tests viven en `__tests__/`, espejando la ruta del código (`__tests__/lib/...`, `__tests__/app/...`). El alias `@/` funciona igual que en la app.
- `scripts/fix_guardian.js` está excluido de git localmente (`.git/info/exclude`) porque contiene credenciales hardcodeadas.
