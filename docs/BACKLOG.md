# Backlog

Categorías: `seguridad` · `refactor` · `tests` · `tooling` · `bd-pendiente` (fuera de alcance hasta que se habilite trabajar la BD).

## Prioridad alta

- [ ] `seguridad` Decidir estrategia de auth en servidor (sesión con cookie httpOnly + proxy/middleware de Next 16) y proteger `/api/admin/*` y `/admin`. Ver BUGS S1-S3. Requiere acordar el contrato: cambia el comportamiento de la API.
- [ ] `seguridad` Hash de contraseñas (bcrypt/argon2) con migración de las existentes. Ver S4. Toca BD.
- [ ] `seguridad` Quitar el admin hardcodeado del login. Ver S5.
- [x] `tests` Caracterizar los route handlers mockeando `@/lib/db` antes de cualquier refactor de API (2026-09-28).
- [ ] `seguridad` Corregir F11: DELETE sobre PK compuesta en `admin/tablas` (puede borrar permisos masivamente).
- [ ] `tests` Caracterizar el frontend: helpers puros de `dashboard` y `DynamicForm`.
- [ ] `tooling` Los snapshots se guardan con LF y git tiene `autocrlf`. Si un clon nuevo rompe los snapshots, agregar un `.gitattributes` con `eol=lf`.

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
