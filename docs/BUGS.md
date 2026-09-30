# Bugs conocidos

Detectados en el relevamiento inicial (2026-09-28). No se corrigen dentro de refactors; cada uno va en tarea aparte.
Severidad: 🔴 crítica · 🟠 alta · 🟡 media · ⚪ baja.

## Seguridad

| # | Sev | Ubicación | Descripción |
|---|---|---|---|
| S1 | 🟡 | todas las rutas `app/api/**` | **Mitigado (2026-09-28) detrás de `AUTH_ENFORCED`.** Sesión con cookie firmada. Sigue abierto hasta prender el flag en producción. |
| S2 | 🟡 | `app/api/admin/tablas/route.js` | **Mitigado detrás de `AUTH_ENFORCED`:** requiere rol admin. Un admin todavía puede leer las contraseñas con `GET ?tabla=USUARIOS` (ver S4). |
| S3 | 🟡 | `app/api/admin/*`, `app/admin/page.jsx` | **Mitigado detrás de `AUTH_ENFORCED`:** rol admin en la API y en el proxy de `/admin`. |
| S4 | 🔴 | `auth/login/route.js:23`, `auth/register/route.js:28`, `admin/usuarios/route.js:49` | Contraseñas almacenadas y comparadas en texto plano. |
| S5 | 🟠 | `auth/login/route.js:30-36`, `scripts/insercion_data_DML.txt:16` | Admin hardcodeado (`admin@bycar.co` / `admin`). |
| S6 | 🟡 | ver abajo | **Mitigado (2026-09-29) detrás de `AUTH_ENFORCED`:** cada ruta de usuario valida la pertenencia del recurso (ver `ARCHITECTURE.md`). Sigue abierto hasta prender el flag. Descripción original: |
| S6 (orig.) | 🟠 | `mensajes/route.js:8,64`; `solicitudes/route.js:37`; `guardian/route.js:9,133` | IDOR: cualquiera puede leer chats ajenos, suplantar al emisor, aceptar solicitudes ajenas y leer o modificar guardianes ajenos. |
| S7 | 🟠 | `scripts/fix_guardian.js:1-3` | Credenciales de BD hardcodeadas. Está excluido de git, pero conviene rotar la contraseña si se reutiliza en otro lado. |
| S9 | 🔴 | `scripts/diagrama.txt:7, 25, 34` | Credenciales de Oracle en texto plano y versionadas: el usuario SYSTEM y el usuario de la aplicación (`US_BYCAR`). A diferencia de S7, este archivo sí está en git, y probablemente también en el repo de GitHub. Hay que rotar ambas contraseñas y sacarlas del historial (tarea de una persona: toca credenciales). Detectado el 2026-09-30. |
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
| ~~F11~~ | ✅ | `admin/tablas/route.js` | **Resuelto 2026-09-28.** PUT/DELETE con PK compuesta (PERMISOS) afectaban todas las filas del usuario. Ahora responden 400 sin ejecutar SQL. Los permisos se gestionan desde `admin/permisos`. |
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
| ~~F27~~ | ✅ | `app/admin/page.jsx` | **Resuelto 2026-09-29.** Guardaba el body de error de `?list=1` y de `?metadata=1` como si fuera una lista: el panel quedaba en blanco o se rompía al abrir "Nuevo". Además, si fallaba la carga al cambiar de tabla, quedaban en pantalla las filas de la tabla anterior. Ahora valida `res.ok` y que sea un array, y ante error vacía columnas y filas. |
| E4 | 🟡 | `mensajes/route.js:25,81`; `guardian/route.js:75` | Lee `rows.length` o `rows[0]` sin guarda: si el resultado no trae `rows` da 500, y en guardian expone el mensaje de JS. |
| E5 | ⚪ | `guardian/route.js:12,135`; `admin/usuarios/route.js:73-75` | Abren la conexión o parsean el JSON antes de validar parámetros. |

### Detectados en el relevamiento de deuda técnica (2026-09-30)

Encontrados leyendo el código; ninguno tiene test que lo fije todavía.

| # | Sev | Ubicación | Descripción |
|---|---|---|---|
| F28 | 🟠 | `dashboard/page.jsx:238-240, 336-372` | La alerta del guardián depende de que el viajero tenga el dashboard abierto: el estado `Alerta` solo se escribe desde el temporizador del navegador. Si cierra la pestaña o se queda sin señal, el contacto nunca ve la alerta. Al recargar con el tiempo vencido se marca "alerta enviada" en pantalla sin hacer el `PUT`. Tampoco se envía ningún correo, aunque la UI dice "Se envió una alerta a…". |
| F29 | 🟡 | `dashboard/page.jsx:498-520` | El mensaje de chat se agrega a la lista antes de enviarlo y no se revisa `res.ok`: si la API responde 403 o 500, queda en pantalla como enviado hasta el próximo refresco (3 s), donde desaparece sin aviso. |
| F30 | ⚪ | `dashboard/page.jsx:584-586` | Tras publicar, el reinicio de `nuevaRuta` omite `marca` (el `select` pasa de controlado a no controlado) y la ruta nueva se agrega al final de una lista ordenada de forma descendente, con los datos crudos del formulario, hasta el próximo refresco. |
| F31 | 🟡 | `admin/page.jsx:234-236` | `getRowId` usa una lista manual de PKs que no incluye `ID_SOL` ni `ID_EST_VIA`. Para SOLICITUDES y ESTADOS_VIA cae en "la primera columna" de una consulta de metadatos sin orden garantizado: editar o borrar puede mandar como id el valor de otra columna. Además, un id con valor 0 se trata como ausente. |
| ~~F32~~ | ✅ | `scripts/create_admin_user.js` | **Resuelto 2026-09-30:** se eliminó el script, que no podía ejecutarse (DT-23). |
| E6 | ⚪ | `admin/page.jsx:103-107, 119-131` | Si el registro se guarda pero falla la recarga posterior (`refreshData` no valida `res.ok`), se muestra "Registro creado" y enseguida "Error de red", y el modal queda abierto. |

### Detectados al caracterizar el frontend (2026-09-30)

Cada uno está fijado por un test cuyo nombre dice "comportamiento actual". F28, F29 y F30 (tabla anterior) también quedaron fijados en `__tests__/app/dashboard-*.test.jsx`.

| # | Sev | Ubicación | Descripción |
|---|---|---|---|
| F33 | 🟡 | `login/page.jsx:31-33`, `auth/login/route.js` | El login del admin no devuelve `user`, así que no pisa el `user` de `localStorage`: si antes había entrado un usuario, sus datos quedan guardados durante la sesión del admin y el dashboard los sigue usando. Test: `__tests__/app/login.test.jsx`. |
| F34 | 🟡 | `dashboard/page.jsx:27, 184` | Un municipio sin nombre (`NOMBRE_MUN` nulo) queda como `nombre: ''`. Al filtrar, `normalizar(m.nombre \|\| m)` recibe el objeto entero y lanza `str.normalize is not a function`: el dashboard se rompe al escribir en Origen o Destino. Test: `dashboard-navegacion.test.jsx`. |
| F35 | 🟡 | `dashboard/page.jsx:340` | La pre-alerta del guardián solo se dispara si el contador pasa exactamente por 300 s (`next === PRE_ALERTA_SEG`). Con un tiempo de 5 minutos o menos, o al recargar con menos de 5 minutos restantes, el aviso "¿Has llegado?" nunca aparece. Test: `dashboard-guardian.test.jsx`. |
| F36 | ⚪ | `dashboard/page.jsx:412-424` | "Sí, he llegado" desde el modal de pre-alerta finaliza el guardián pero no cierra el modal (`finalizarGuardian` no llama a `setShowReadjustModal(false)`). Además, si la API no devolvió `id` al activar, finalizar no hace el `PUT` y aun así avisa "Guardián desactivado". Test: `dashboard-guardian.test.jsx`. |
| F37 | ⚪ | `dashboard/page.jsx:588` | El aviso usa el estado en masculino: "Solicitud aceptado" / "Solicitud rechazado". Test: `dashboard-solicitudes.test.jsx`. |

## Manejo de errores

| # | Sev | Ubicación | Descripción |
|---|---|---|---|
| E1 | 🟡 | `admin/tablas/route.js:134-135,236-237,310` | `sanitizeTable` y `req.json()` se ejecutan fuera del `try`, así que devuelven un 500 no controlado. |
| E2 | 🟡 | `admin/tablas/route.js:117,218,292,342`; `guardian/route.js:83,126,175` | `connection.close()` sin `try`: si falla, tapa el error original. |
| E3 | ⚪ | `dashboard/page.jsx:188`, `admin/conductores/route.js:31`, `admin/permisos/route.js:43`, otros | `catch` vacíos. |
