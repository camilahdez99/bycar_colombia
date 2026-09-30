# Backlog

Categorías: `seguridad` · `refactor` · `tests` · `tooling` · `bd-pendiente` (fuera de alcance hasta que se habilite trabajar la BD).

## Prioridad alta

- [x] `seguridad` Auth en servidor (cookie firmada + guard + proxy) detrás de `AUTH_ENFORCED` (2026-09-28). Ver BUGS S1-S3.
- [ ] `seguridad` **Rollout de auth:** runbook completo en [`ROLLOUT_AUTH.md`](ROLLOUT_AUTH.md) (lo ejecuta una persona; toca configuración de producción). Resumen:
  1. Configurar `SESSION_SECRET` en producción (se genera con `openssl rand -base64 32`).
  2. Desplegar con el flag apagado y esperar a que los usuarios vuelvan a loguearse (así reciben la cookie).
  3. Verificar que producción sirva por HTTPS: en producción la cookie es `Secure`.
  4. Prender `AUTH_ENFORCED=true`.
  5. ~~Redirección del dashboard ante 401~~: resuelto el 2026-09-29 (`lib/client/sessionFetch.js`).
- [x] `seguridad` **IDOR (S6).** Plan aprobado e implementado el 2026-09-29, detrás de `AUTH_ENFORCED`.
  - **Decisiones:**
    - un ID ajeno responde 403 (no se reemplaza en silencio);
    - el admin saltea la pertenencia;
    - solicitudes: el conductor acepta o rechaza, el pasajero cancela, y "Pendiente" no se puede asignar por API;
    - se autorizan SELECTs nuevos de solo lectura, sin tocar queries existentes.
  1. Helper `lib/auth/ownership.js` con tests.
  2. Fase A, sin SQL nuevo:
     - `usuarioId` en `mis-rutas`, `recibidas`, `chats` y `guardian?usuarioId`;
     - `usuarioId` del body en `POST viajes` y `POST solicitudes`;
     - `mensajes`: validar que seas participante usando la query existente, y que `senderId` sea el de la sesión.
  3. Fase B, con SELECTs nuevos:
     - `PUT solicitudes`: roles según el estado;
     - `POST guardian`: participás del `viajeId`;
     - `PUT guardian`: el guardián es de tu viaje;
     - `GET guardian?email`: el correo es el tuyo.
  4. Test de IDOR sobre todas las rutas: el dueño pasa; otro usuario recibe 403 sin que se ejecute ninguna escritura.
  5. Docs.
- [ ] `seguridad` Quitar el admin hardcodeado (S5) y derivar el rol de `PERFIL_ID_PER` (requiere una query nueva: bd-pendiente).
- [x] `feat` Botón de logout en `/admin` (2026-09-30, `lib/client/logout.js`).
- [ ] `refactor` El dashboard tiene su propio `cerrarSesion`; podría usar `lib/client/logout.js` (cambia `router.push('/')` por una navegación completa).
- [x] `feat` `/admin` y `PermisosManager` usan `fetchConSesion` (2026-09-29).
- [x] `fix` F27: el panel admin se rompía ante respuestas de error (2026-09-29).
- [ ] `seguridad` Hash de contraseñas (bcrypt/argon2) con migración de las existentes. Ver S4. Toca BD.
- [ ] `seguridad` Quitar el admin hardcodeado del login. Ver S5.
- [x] `tests` Caracterizar los route handlers mockeando `@/lib/db` antes de cualquier refactor de API (2026-09-28).
- [x] `seguridad` Corregir F11: DELETE sobre PK compuesta en `admin/tablas` (2026-09-28).
- [ ] `tests` Caracterizar el frontend: helpers puros de `dashboard` y `DynamicForm`.
- [x] `tooling` `.gitattributes` con `eol=lf` (2026-09-30); verificado con un clon nuevo.

## Tooling

- [ ] `tooling` El lint falla en la línea base: 5 errores y 3 warnings, sobre todo `react-hooks/set-state-in-effect` en `components/DynamicForm.jsx` y `components/admin/HydrationWrapper.jsx`. Corregirlo en una tarea aparte (implica cambiar código de componentes) y después volverlo obligatorio en la suite.
- [ ] `tooling` Warnings de `npm approve-scripts` pendientes (`oracledb`, `sharp`, `unrs-resolver`). Revisar si hace falta aprobarlos.

## Refactor

- [ ] `refactor` `app/dashboard/page.jsx` es un monolito: extraer helpers puros (`normalizar`, `formatTiempo`, `formatCurrency`, `getBadgeCount`) a `lib/`, con tests previos.
- [ ] `refactor` Extraer la lógica embebida en los handlers (estados de solicitud, limpieza de datos de viaje) a funciones puras testeables.
- [ ] `refactor` `components/admin/FormularioConductor.jsx` y `FormularioVehiculo.jsx` no se usan. Confirmar antes de eliminarlos.
- [ ] `refactor` Logs estructurados en lugar de `console.error` sueltos.

## bd-pendiente

- [ ] `bd-pendiente` `admin/tablas/route.js:96,163-166,264-272,319-322`: nombres de tabla y columna interpolados en el SQL (mitigado con regex y lista de columnas). La PK puede venir `undefined` y el `SET` puede quedar vacío.
- [ ] `bd-pendiente` IDs generados con `MAX+1` (condición de carrera): `admin/usuarios/route.js:39`, `viajes/route.js:23,63`.
- [ ] `bd-pendiente` IDs generados con `Date.now()`: `auth/register:16`, `guardian:106`, `mensajes:91`, `solicitudes:14`, `viajes:173`. Usar secuencias o `IDENTITY`.
- [ ] `bd-pendiente` `viajes/route.js` POST: varios `autoCommit` sin transacción, que dejan huérfanos. Los municipios nuevos quedan con `DEPARTAMENTO_ID_DEP = 1` fijo (:27).
- [ ] `bd-pendiente` `admin/conductores/route.js:56-58`: dos `DELETE` sin transacción (`autoCommit` global en `lib/db.js:5`).
- [ ] `bd-pendiente` `lib/db.js`: no hay pool de conexiones y el dashboard consulta cada 3 a 10 s.
- [ ] `bd-pendiente` Estados con IDs mágicos (1, 2…) en `solicitudes:18,46`, `guardian:42,110`, `viajes:102`.
- [ ] `bd-pendiente` IDs pasados como string sin `Number()` (`solicitudes:21`, `admin/*`).
- [ ] `bd-pendiente` Falta `ORDER BY` en `admin/viajes/route.js:8-23`; `ROWNUM = 1` sin orden en `guardian/route.js:27`.
