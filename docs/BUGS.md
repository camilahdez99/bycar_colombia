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

### Detectados al caracterizar la API (2026-09-28)

Cada uno está fijado por un test cuyo nombre dice "comportamiento actual".

| # | Sev | Ubicación | Descripción |
|---|---|---|---|
| F11 | 🔴 | `admin/tablas/route.js:30,317-327` | `getPrimaryKey` toma solo la primera columna de la PK. En tablas con PK compuesta (PERMISOS), `DELETE ?id=` borra todas las filas que coinciden con esa columna. |
| F12 | 🟠 | `admin/tablas/route.js:172-193` | Un INSERT en MENUS sin `ID_ENU` corre con `autoCommit: false`, nunca se commitea y aun así devuelve 201. Probablemente se pierde al cerrar la conexión. |
| F13 | 🟡 | `admin/tablas/route.js:30,96,271,321` | Si la tabla no tiene PK se genera `WHERE undefined = :id`. |
| F14 | 🟡 | `admin/tablas/route.js:101,326` | GET y DELETE por id usan `Number(id)`, así que las claves de texto (placa) quedan NaN. PUT la envía como string: los tres métodos son inconsistentes. |
| F15 | 🟡 | `admin/tablas/route.js:161-167,264-272` | Si ninguna clave del body coincide con una columna, arma `INSERT … () VALUES ()` o `SET` vacío. Responde con un error de Oracle en lugar de 400. |
| F16 | 🟡 | `admin/vehiculos/route.js:62` vs `:101,128` | POST pasa la placa a mayúsculas; PUT y DELETE la usan tal como llega. Una placa en minúsculas no coincide, pero igual responde 200. |
| F17 | 🟡 | `admin/viajes/route.js:74-89` | `estado` no se valida: si falta queda bindeado como `undefined` (probablemente NULL), y si llega `""` o `null` se convierte en 0. |
| F18 | 🟡 | `admin/usuarios/route.js:49,88` | Crear o editar desde admin no normaliza el correo (no hace trim ni minúsculas), a diferencia de register. |
| F19 | 🟡 | todos los PUT y DELETE de `admin/*`; `solicitudes` PUT; `guardian` PUT | Ignoran `rowsAffected`: responden 200 aunque el registro no exista. `guardian` PUT sin `id` también responde 200. |
| F20 | 🟡 | `solicitudes/route.js:56-69` | Acepta cualquier estado numérico (por ejemplo 99). |
| F21 | 🟡 | `guardian/route.js:149-158` | Si ningún estado coincide con el texto, `ESTADO_ID_EST` queda en NULL. |
| F22 | 🟡 | `guardian/route.js:137-141` | Con `extraTiempo: null` suma 0 minutos e ignora el `estado` enviado (solo compara contra `undefined`). |
| F23 | 🟡 | `viajes/route.js:147-148,174`; `guardian/route.js:118` | `puestos`, `valor` y `tiempo` no se validan: se inserta NaN. La placa se recorta a 6 caracteres (placas distintas pueden colisionar) y una placa que no es texto da 500. |
| F24 | ⚪ | `viajes/route.js:106-107` | `?origen=%20` pasa el `isNaN` y filtra por el municipio 0. |
| F25 | ⚪ | `guardian/route.js:118` | No valida que `viajeId` exista ni que pertenezca al usuario. |
| F26 | ⚪ | `conductores/route.js:38-42` | POST responde 200 con un mensaje informativo y no crea nada. |
| E4 | 🟡 | `mensajes/route.js:25,81`; `guardian/route.js:75` | Lee `rows.length` o `rows[0]` sin guarda: si el resultado no trae `rows` da 500, y en guardian expone el mensaje de JS. |
| E5 | ⚪ | `guardian/route.js:12,135`; `admin/usuarios/route.js:73-75` | Abren la conexión o parsean el JSON antes de validar parámetros. |

## Manejo de errores

| # | Sev | Ubicación | Descripción |
|---|---|---|---|
| E1 | 🟡 | `admin/tablas/route.js:134-135,236-237,310` | `sanitizeTable` y `req.json()` se ejecutan fuera del `try`, así que devuelven un 500 no controlado. |
| E2 | 🟡 | `admin/tablas/route.js:117,218,292,342`; `guardian/route.js:83,126,175` | `connection.close()` sin `try`: si falla, tapa el error original. |
| E3 | ⚪ | `dashboard/page.jsx:188`, `admin/conductores/route.js:31`, `admin/permisos/route.js:43`, otros | `catch` vacíos. |
