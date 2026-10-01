# Bugs conocidos

Detectados en el relevamiento inicial (2026-09-28). No se corrigen dentro de refactors; cada uno va en tarea aparte.
Severidad: 🔴 crítica · 🟠 alta · 🟡 media · ⚪ baja.

## Seguridad

| # | Sev | Ubicación | Descripción |
|---|---|---|---|
| S1 | 🟡 | todas las rutas `app/api/**` | **Mitigado (2026-09-28) detrás de `AUTH_ENFORCED`.** Sesión con cookie firmada. Sigue abierto hasta prender el flag en producción. |
| S2 | 🟡 | `app/api/admin/tablas/route.js` | **Mitigado detrás de `AUTH_ENFORCED`:** requiere rol admin. Un admin todavía puede leer las contraseñas con `GET ?tabla=USUARIOS` (ver S4). |
| S3 | 🟡 | `app/api/admin/*`, `app/admin/page.jsx` | **Mitigado detrás de `AUTH_ENFORCED`:** rol admin en la API y en el proxy de `/admin`. |
| S4 | 🔴 | `auth/login/route.js:23`, `auth/register/route.js:28` | Contraseñas almacenadas y comparadas en texto plano. |
| S5 | 🟡 | `auth/login/route.js:30-36`, `scripts/insercion_data_DML.txt:16` | **Mitigado (2026-10-01):** el login lee el admin de `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Si faltan, el atajo de admin queda deshabilitado. Sigue abierto: el seed DML versionado tiene un usuario `admin@bycar.co` con contraseña `admin` en `USUARIOS`. Si esa fila existe en producción, entra al dashboard como usuario común: hay que cambiar su contraseña (tarea de una persona, toca BD y credenciales). Descripción original: admin hardcodeado (`admin@bycar.co` / `admin`). |
| S6 | 🟡 | ver abajo | **Mitigado (2026-09-29) detrás de `AUTH_ENFORCED`:** cada ruta de usuario valida la pertenencia del recurso (ver `ARCHITECTURE.md`). Sigue abierto hasta prender el flag. Descripción original: |
| S6 (orig.) | 🟠 | `mensajes/route.js:8,64`; `solicitudes/route.js:37`; `guardian/route.js:9,133` | IDOR: cualquiera puede leer chats ajenos, suplantar al emisor, aceptar solicitudes ajenas y leer o modificar guardianes ajenos. |
| S7 | 🟠 | `scripts/fix_guardian.js:1-3` | Credenciales de BD hardcodeadas. Está excluido de git, pero conviene rotar la contraseña si se reutiliza en otro lado. |
| S9 | 🔴 | `scripts/diagrama.txt:7, 25, 34` | Credenciales de Oracle en texto plano y versionadas: el usuario SYSTEM y el usuario de la aplicación (`US_BYCAR`). A diferencia de S7, este archivo sí está en git, y probablemente también en el repo de GitHub. Hay que rotar ambas contraseñas y sacarlas del historial (tarea de una persona: toca credenciales). Detectado el 2026-09-30. |
| ~~S8~~ | ✅ | `admin/permisos/route.js:41`, `guardian/route.js:81`, `viajes/route.js:187`, `admin/*` | **Resuelto 2026-10-01 (DT-06): los 500 devuelven un mensaje seguro (`lib/api/errores.js`); el texto de Oracle queda solo en el log.** Se devuelve `error.message` de Oracle al cliente. |

## Funcionales

| # | Sev | Ubicación | Descripción |
|---|---|---|---|
| ~~F1~~ | ✅ | `dashboard/page.jsx:547,569` | **Resuelto 2026-10-01: sin usuario se avisa "Inicia sesión para continuar" y no se llama a la API.** Si no hay sesión se usa `|| 1` como ID: las acciones quedan a nombre del usuario 1. |
| F2 | 🟠 | `solicitudes/route.js:4-23` | No valida cupos, duplicados ni que el usuario se auto-solicite su viaje. Aceptar no descuenta `CUPOS_DISPONIBLES_VIA`. |
| F3 | 🟠 | `viajes/route.js:159-171` | Si la placa pertenece a otro usuario, igual se publica el viaje con ese vehículo. |
| F4 | 🟡 | `mensajes/route.js:32-38` | Los mensajes se filtran por par de usuarios y no por chat: dos viajes entre las mismas personas comparten historial. |
| F5 | 🟡 | `guardian/route.js:50-72` | El conductor nunca ve su guardián, porque el JOIN exige una solicitud aceptada propia. El comentario dice lo contrario. |
| ~~F6~~ | ✅ | `viajes/route.js:9,38` | **Resuelto 2026-10-01 (DT-31): solo un número entero completo se toma como ID (`idDeCatalogo`).** `parseInt("2024 Mazda")` devuelve 2024 y se usa como ID de marca o municipio. |
| F7 | 🟡 | `dashboard/page.jsx:192` vs `login/route.js:21` | Se lee `PERFIL_ID_PER`, pero el login no lo devuelve: siempre es null. |
| ~~F8~~ | ✅ | `dashboard/page.jsx:454` | **Resuelto 2026-10-01: null o undefined dan "".** `formatCurrency` falla con valor null. |
| ~~F9~~ | ✅ | `dashboard/page.jsx:302` | **Resuelto 2026-10-01: el correo va con encodeURIComponent.** El correo va en la query sin `encodeURIComponent`. |
| F10 | ⚪ | `guardian/route.js:154` | El estado se resuelve comparando los primeros 6 caracteres del texto: es frágil. |

### Detectados al caracterizar la API (2026-09-28)

Cada uno está fijado por un test cuyo nombre dice "comportamiento actual".

| # | Sev | Ubicación | Descripción |
|---|---|---|---|
| ~~F11~~ | ✅ | `admin/tablas/route.js` | **Resuelto 2026-09-28.** PUT/DELETE con PK compuesta (PERMISOS) afectaban todas las filas del usuario. Ahora responden 400 sin ejecutar SQL. Los permisos se gestionan desde `admin/permisos`. |
| ~~F12~~ | ✅ | `admin/tablas/route.js:172-193` | **Resuelto 2026-10-01: el INSERT en MENUS se confirma siempre.** Un INSERT en MENUS sin `ID_ENU` corre con `autoCommit: false`, nunca se commitea y aun así devuelve 201. Probablemente se pierde al cerrar la conexión. |
| ~~F13~~ | ✅ | `admin/tablas/route.js:30,96,271,321` | **Resuelto 2026-10-01: tabla sin PK → 400.** Si la tabla no tiene PK se genera `WHERE undefined = :id`. |
| ~~F14~~ | ✅ | `admin/tablas/route.js:101,326` | **Resuelto 2026-10-01: GET, PUT y DELETE bindean el id como texto.** GET y DELETE por id usan `Number(id)`, así que las claves de texto (placa) quedan NaN. PUT la envía como string: los tres métodos son inconsistentes. |
| ~~F15~~ | ✅ | `admin/tablas/route.js:161-167,264-272` | **Resuelto 2026-10-01: sin columnas válidas → 400.** Si ninguna clave del body coincide con una columna, arma `INSERT … () VALUES ()` o `SET` vacío. Responde con un error de Oracle en lugar de 400. |
| ~~F16~~ | ✅ | `admin/vehiculos/route.js:62` vs `:101,128` | **No aplica (2026-10-01): la ruta se eliminó (DT-46).** POST pasa la placa a mayúsculas; PUT y DELETE la usan tal como llega. Una placa en minúsculas no coincide, pero igual responde 200. |
| ~~F17~~ | ✅ | `admin/viajes/route.js:74-89` | **No aplica (2026-10-01): la ruta se eliminó (DT-46).** `estado` no se valida: si falta queda bindeado como `undefined` (probablemente NULL), y si llega `""` o `null` se convierte en 0. |
| ~~F18~~ | ✅ | `admin/usuarios/route.js:49,88` | **No aplica (2026-10-01): la ruta se eliminó (DT-46).** Crear o editar desde admin no normaliza el correo (no hace trim ni minúsculas), a diferencia de register. |
| ~~F19~~ | ✅ | todos los PUT y DELETE de `admin/*`; `solicitudes` PUT; `guardian` PUT | **Resuelto 2026-10-01 en `admin/tablas`, `solicitudes` y `guardian` (404 con rowsAffected = 0). Las rutas `admin/*` restantes se eliminan en DT-46.** Ignoran `rowsAffected`: responden 200 aunque el registro no exista. `guardian` PUT sin `id` también responde 200. |
| ~~F20~~ | ✅ | `solicitudes/route.js:56-69` | **Resuelto 2026-10-01 (DT-31): solo estados del catálogo; el resto → 400.** Acepta cualquier estado numérico (por ejemplo 99). |
| F21 | 🟡 | `guardian/route.js:149-158` | Si ningún estado coincide con el texto, `ESTADO_ID_EST` queda en NULL. |
| ~~F22~~ | ✅ | `guardian/route.js:137-141` | **Resuelto 2026-10-01: `extraTiempo: null` cuenta como ausente.** Con `extraTiempo: null` suma 0 minutos e ignora el `estado` enviado (solo compara contra `undefined`). |
| ~~F23~~ | ✅ | `viajes/route.js:147-148,174`; `guardian/route.js:118` | **Resuelto 2026-10-01 (DT-31): `puestos`, `valor`, `fecha`, `placa` (1 a 6 alfanuméricos, sin recortar) y `tiempo` se validan → 400.** `puestos`, `valor` y `tiempo` no se validan: se inserta NaN. La placa se recorta a 6 caracteres (placas distintas pueden colisionar) y una placa que no es texto da 500. |
| ~~F24~~ | ✅ | `viajes/route.js:106-107` | **Resuelto 2026-10-01: un filtro de solo espacios se ignora.** `?origen=%20` pasa el `isNaN` y filtra por el municipio 0. |
| F25 | ⚪ | `guardian/route.js:118` | No valida que `viajeId` exista ni que pertenezca al usuario. |
| ~~F26~~ | ✅ | `conductores/route.js:38-42` | **No aplica (2026-10-01): la ruta se eliminó (DT-46).** POST responde 200 con un mensaje informativo y no crea nada. |
| ~~F27~~ | ✅ | `app/admin/page.jsx` | **Resuelto 2026-09-29.** Guardaba el body de error de `?list=1` y de `?metadata=1` como si fuera una lista: el panel quedaba en blanco o se rompía al abrir "Nuevo". Además, si fallaba la carga al cambiar de tabla, quedaban en pantalla las filas de la tabla anterior. Ahora valida `res.ok` y que sea un array, y ante error vacía columnas y filas. |
| ~~E4~~ | ✅ | `mensajes/route.js:25,81`; `guardian/route.js:75` | **Resuelto 2026-10-01: un resultado sin `rows` se trata como vacío.** Lee `rows.length` o `rows[0]` sin guarda: si el resultado no trae `rows` da 500, y en guardian expone el mensaje de JS. |
| ~~E5~~ | ✅ | `guardian/route.js:12,135` | **Resuelto 2026-10-01 en `guardian` (y `solicitudes`): se valida antes de abrir la conexión.** Abren la conexión o parsean el JSON antes de validar parámetros. |

### Detectados en el relevamiento de deuda técnica (2026-09-30)

Encontrados leyendo el código; ninguno tiene test que lo fije todavía.

| # | Sev | Ubicación | Descripción |
|---|---|---|---|
| F28 | 🟠 | `dashboard/page.jsx:238-240, 336-372` | **Parcial 2026-10-01:** al recargar con el tiempo vencido ahora se registra la alerta (PUT, una sola vez). Sigue abierto: si el viajero no vuelve a abrir el dashboard, la alerta nunca se registra, porque no hay un proceso en el servidor que la dispare, y tampoco se envía correo. La alerta del guardián depende de que el viajero tenga el dashboard abierto: el estado `Alerta` solo se escribe desde el temporizador del navegador. Si cierra la pestaña o se queda sin señal, el contacto nunca ve la alerta. Al recargar con el tiempo vencido se marca "alerta enviada" en pantalla sin hacer el `PUT`. Tampoco se envía ningún correo, aunque la UI dice "Se envió una alerta a…". |
| ~~F29~~ | ✅ | `dashboard/page.jsx:498-520` | **Resuelto 2026-10-01: si el POST falla, el mensaje se saca, vuelve al input y se avisa.** El mensaje de chat se agrega a la lista antes de enviarlo y no se revisa `res.ok`: si la API responde 403 o 500, queda en pantalla como enviado hasta el próximo refresco (3 s), donde desaparece sin aviso. |
| ~~F30~~ | ✅ | `dashboard/page.jsx:584-586` | **Resuelto 2026-10-01: la ruta publicada va primera.** Tras publicar, el reinicio de `nuevaRuta` omite `marca` (el `select` pasa de controlado a no controlado) y la ruta nueva se agrega al final de una lista ordenada de forma descendente, con los datos crudos del formulario, hasta el próximo refresco. |
| ~~F31~~ | ✅ | `admin/page.jsx:234-236` | **Resuelto 2026-10-01: la fila se identifica por la PK de su tabla (`lib/client/clavesPrimarias.js`).** `getRowId` usa una lista manual de PKs que no incluye `ID_SOL` ni `ID_EST_VIA`. Para SOLICITUDES y ESTADOS_VIA cae en "la primera columna" de una consulta de metadatos sin orden garantizado: editar o borrar puede mandar como id el valor de otra columna. Además, un id con valor 0 se trata como ausente. |
| ~~F32~~ | ✅ | `scripts/create_admin_user.js` | **Resuelto 2026-09-30:** se eliminó el script, que no podía ejecutarse (DT-23). |
| ~~E6~~ | ✅ | `admin/page.jsx:103-107, 119-131` | **Resuelto 2026-10-01: se avisa "Se guardó el cambio, pero no se pudo recargar la lista" y el modal se cierra.** Si el registro se guarda pero falla la recarga posterior (`refreshData` no valida `res.ok`), se muestra "Registro creado" y enseguida "Error de red", y el modal queda abierto. |

### Detectados al caracterizar el frontend (2026-09-30)

Cada uno está fijado por un test cuyo nombre dice "comportamiento actual". F28, F29 y F30 (tabla anterior) también quedaron fijados en `__tests__/app/dashboard-*.test.jsx`.

| # | Sev | Ubicación | Descripción |
|---|---|---|---|
| ~~F33~~ | ✅ | `login/page.jsx` | **Resuelto 2026-10-01.** El login del admin no devuelve `user` y dejaba en `localStorage` los datos del usuario anterior. Ahora, si un login correcto no trae `user`, se borra el guardado; un login de usuario lo reemplaza como antes y un error no lo toca. |
| ~~F34~~ | ✅ | `dashboard/page.jsx` | **Resuelto 2026-10-01.** Un municipio sin nombre (`NOMBRE_MUN` nulo) hacía que `normalizar` recibiera el objeto entero y el dashboard se rompía al escribir en Origen o Destino. Ahora el autocompletado toma el texto con `nombreDeOpcion` (`lib/client/formato.js`), que devuelve `''` para un municipio sin nombre: esa opción no coincide con ninguna búsqueda y el resto funciona igual. |
| ~~F35~~ | ✅ | `dashboard/page.jsx` | **Resuelto 2026-10-01.** La pre-alerta del guardián exigía pasar justo por 300 s, así que con 5 minutos o menos (o al recargar con menos de 5 minutos) nunca salía. Ahora sale al estar en 300 s o menos y antes de terminar, una sola vez por tramo; tras extender el tiempo vuelve a salir. |
| ~~F36~~ | ✅ | `dashboard/page.jsx` | **Resuelto 2026-10-01.** "Sí, he llegado" ahora cierra el modal de pre-alerta. Sin `id` del guardián (no se hace el `PUT`) ya no avisa "Guardián desactivado": desactiva en pantalla y avisa que la llegada no quedó registrada. Lo que sigue abierto pasó a F38. |
| ~~F37~~ | ✅ | `dashboard/page.jsx` | **Resuelto 2026-10-01.** El aviso dice "Solicitud aceptada" / "Solicitud rechazada". El estado que se envía a la API no cambió. |
| ~~F38~~ | ✅ | `dashboard/page.jsx:413-446` | **Resuelto 2026-10-01:** si el PUT no se registra (error de la API o de red), el guardián sigue activo, no se suma tiempo y se pide reintentar. `finalizarGuardian` y `reajustarTiempo` no revisan la respuesta del `PUT`: si la API responde 403/500 igual se avisa "Guardián desactivado" o "Tiempo extendido" y el estado local cambia, aunque en la BD el guardián siga activo con el tiempo anterior. Si el `fetch` falla por red, la promesa se rechaza sin manejo y el estado no se actualiza. Detectado al corregir F36 (2026-10-01); sin test que lo fije. |
| ~~F39~~ | ✅ | `hooks/dashboard/useGuardian.js` | **Resuelto 2026-10-01.** Cada tick calcula los segundos que faltan hasta el vencimiento (`segundosHasta`), así que el contador, la pre-alerta y la alerta no se atrasan con la pestaña en segundo plano (desfase medido: 295 s → 0 s). Tests: `dashboard-guardian.test.jsx` (2) y `cuentaRegresiva.test.js` (2), fallaban sin el cambio. Original: El contador del guardián descuenta 1 por tick de `setInterval` en vez de calcular contra la hora de inicio. Con la pestaña en segundo plano el navegador espacia los ticks (hasta 1 por minuto): tras 5 min oculto muestra `29:55` en lugar de `25:00` (295 s de atraso), y la pre-alerta y la alerta se disparan tarde. Medido en `bench/dashboard-guardian-timer.perf.jsx` (ver `docs/PERFORMANCE.md`). Relacionado con F28 y DT-35. |
| F40 | 🟡 | `hooks/dashboard/useGuardian.js` | Cuando el tiempo se agota con el modal de pre-alerta abierto, el modal sigue abierto. "+15 min" hace el `PUT` de `extraTiempo` y muestra 15:00, pero el contador queda congelado (el intervalo se detuvo con la alerta y `activo` no cambia) y la pantalla sigue diciendo "ALERTA ENVIADA". Decidir si tras la alerta se cierra el modal o si extender reactiva el guardián (y qué pasa con el estado `Alerta` en la BD). |

## Manejo de errores

| # | Sev | Ubicación | Descripción |
|---|---|---|---|
| ~~E1~~ | ✅ | `admin/tablas/route.js:134-135,236-237,310` | **Resuelto 2026-10-01: nombre de tabla o JSON inválidos → 400 en los cuatro métodos.** `sanitizeTable` y `req.json()` se ejecutan fuera del `try`, así que devuelven un 500 no controlado. |
| ~~E2~~ | ✅ | `admin/tablas/route.js:117,218,292,342`; `guardian/route.js:83,126,175` | **Resuelto 2026-10-01: `tablas` y `guardian` cierran con `closeConnection`.** `connection.close()` sin `try`: si falla, tapa el error original. |
| ~~E3~~ | ✅ | `dashboard/page.jsx:188`, `admin/permisos/route.js:43`, otros | **Resuelto 2026-09-30 (DT-05):** no quedan `catch` vacíos en `app/` ni `lib/`. `catch` vacíos. |
