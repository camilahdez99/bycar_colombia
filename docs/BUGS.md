# Bugs conocidos

Detectados en el relevamiento inicial (2026-09-28). No se corrigen dentro de refactors; cada uno va en tarea aparte.
Severidad: 🔴 crítica · 🟠 alta · 🟡 media · ⚪ baja.

## Seguridad

| # | Sev | Ubicación | Descripción |
|---|---|---|---|
| S1 | 🔴 | todas las rutas `app/api/**` | No hay autenticación en el servidor: sin middleware, cookies ni tokens. La "sesión" es `localStorage`. |
| S2 | 🔴 | `app/api/admin/tablas/route.js` | CRUD genérico sin autenticación sobre cualquier tabla. `GET ?tabla=USUARIOS` expone las contraseñas. |
| S3 | 🔴 | `app/api/admin/*`, `app/admin/page.jsx` | Ninguna ruta ni página de admin verifica rol. |
| S4 | 🔴 | `auth/login/route.js:23`, `auth/register/route.js:28`, `admin/usuarios/route.js:49` | Contraseñas almacenadas y comparadas en texto plano. |
| S5 | 🟠 | `auth/login/route.js:14`, `scripts/create_admin_user.js:13`, `scripts/insercion_data_DML.txt:16` | Admin hardcodeado (`admin@bycar.co` / `admin`). |
| S6 | 🟠 | `mensajes/route.js:8,64`; `solicitudes/route.js:37`; `guardian/route.js:9,133` | IDOR: cualquiera puede leer chats ajenos, suplantar al emisor, aceptar solicitudes ajenas y leer o modificar guardianes ajenos. |
| S7 | 🟠 | `scripts/fix_guardian.js:1-3` | Credenciales de BD hardcodeadas. Está excluido de git, pero conviene rotar la contraseña si se reutiliza en otro lado. |
| S8 | 🟡 | `admin/permisos/route.js:41`, `guardian/route.js:81`, `viajes/route.js:187`, `admin/*` | Se devuelve `error.message` de Oracle al cliente. |

## Funcionales

| # | Sev | Ubicación | Descripción |
|---|---|---|---|
| F1 | 🟠 | `dashboard/page.jsx:547,569` | Si no hay sesión se usa `|| 1` como ID: las acciones quedan a nombre del usuario 1. |
| F2 | 🟠 | `solicitudes/route.js:4-23` | No valida cupos, duplicados ni que el usuario se auto-solicite su viaje. Aceptar no descuenta `CUPOS_DISPONIBLES_VIA`. |
| F3 | 🟠 | `viajes/route.js:159-171` | Si la placa pertenece a otro usuario, igual se publica el viaje con ese vehículo. |
| F4 | 🟡 | `mensajes/route.js:32-38` | Los mensajes se filtran por par de usuarios y no por chat: dos viajes entre las mismas personas comparten historial. |
| F5 | 🟡 | `guardian/route.js:50-72` | El conductor nunca ve su guardián, porque el JOIN exige una solicitud aceptada propia. El comentario dice lo contrario. |
| F6 | 🟡 | `viajes/route.js:9,38` | `parseInt("2024 Mazda")` devuelve 2024 y se usa como ID de marca o municipio. |
| F7 | 🟡 | `dashboard/page.jsx:192` vs `login/route.js:21` | Se lee `PERFIL_ID_PER`, pero el login no lo devuelve: siempre es null. |
| F8 | ⚪ | `dashboard/page.jsx:454` | `formatCurrency` falla con valor null. |
| F9 | ⚪ | `dashboard/page.jsx:302` | El correo va en la query sin `encodeURIComponent`. |
| F10 | ⚪ | `admin/viajes/route.js:81`, `guardian/route.js:154` | El estado se resuelve comparando los primeros 6 caracteres del texto: es frágil. |

## Manejo de errores

| # | Sev | Ubicación | Descripción |
|---|---|---|---|
| E1 | 🟡 | `admin/tablas/route.js:134-135,236-237,310` | `sanitizeTable` y `req.json()` se ejecutan fuera del `try`, así que devuelven un 500 no controlado. |
| E2 | 🟡 | `admin/tablas/route.js:117,218,292,342`; `guardian/route.js:83,126,175` | `connection.close()` sin `try`: si falla, tapa el error original. |
| E3 | ⚪ | `dashboard/page.jsx:188`, `admin/conductores/route.js:31`, `admin/permisos/route.js:43`, otros | `catch` vacíos. |
