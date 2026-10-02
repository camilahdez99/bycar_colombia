# Changelog

## 2026-10-02 — Ícono del carrito en la pestaña del navegador

Pedido explícito: reemplazar el ícono de la plantilla de Next/Vercel.

**Qué se hizo**
- `app/icon.svg`: el carrito rojo del logo de la app sobre un fondo oscuro redondeado.
- `app/favicon.ico`: reemplaza el de la plantilla (25 931 bytes) por el carrito en 16, 32 y 48 px (2 119 bytes).
- `app/apple-icon.png`: 180 px, para cuando se agrega la web a la pantalla de inicio en iPhone.
- El `.ico` y el `.png` se generaron desde el SVG con `sharp`, que ya venía con Next: no hay dependencias nuevas. Next los detecta solos por convención de archivos, sin tocar `layout.js`.

**Verificación**: `npm test` (944 en verde), `npm run lint` y `npm run build` sin errores. Con `next start`, el `<head>` trae los tres `<link>` y los tres archivos responden 200.

**Riesgos pendientes**: los navegadores guardan el favicon en caché durante mucho tiempo; puede hacer falta recargar con Ctrl+F5 o abrir la web en una ventana de incógnito para ver el nuevo.

## 2026-10-02 — Envío del código por Gmail (SMTP)

Los correos de Brevo llegaban a spam: el remitente era `@elpoli.edu.co`, cuyo SPF (`include:_spf.google.com -all`) no autoriza a Brevo, y sin acceso a ese DNS no hay DKIM. Gmail firma y autoriza sus propios correos, así que llegan a la bandeja de entrada. Es gratis (unos 500 correos por día).

**Qué se hizo**
- Dependencia nueva: `nodemailer` 10.0.13 (autorizada por la usuaria; requiere Node 20 o superior; `npm audit` en 0).
- `lib/email.js`: con `GMAIL_USER` y `GMAIL_APP_PASSWORD` envía por `smtp.gmail.com:465` (TLS) con la propia cuenta como remitente; si no están, sigue usando Brevo. `proveedorDeCorreo()` informa cuál se usa. A la contraseña de aplicación se le quitan los espacios. Los errores de SMTP van al log solo con su código (`EAUTH`, `535`…), sin el destinatario.
- Sin cambios en las rutas, la base ni la pantalla.

**Tests**: 5 nuevos con `nodemailer` simulado (ningún correo real). `npm test` (944 en verde), `npm run lint` y `npm run build` sin errores.

**Riesgos pendientes**
- Gmail exige la verificación en dos pasos para crear contraseñas de aplicación. Las cuentas institucionales suelen tenerlas bloqueadas: conviene un Gmail personal o uno creado para el proyecto.
- Límite de Gmail: unos 500 destinatarios por día. Si se supera, Google suspende el envío por 24 h y el registro responde 502.
- Si se cambia la contraseña de la cuenta de Google, la contraseña de aplicación deja de valer y hay que generar otra.

## 2026-10-02 — Registro con verificación del correo (flag `EMAIL_VERIFICATION`)

Pedido explícito. Detrás del flag `EMAIL_VERIFICATION`, apagado por defecto: sin él, el registro sigue exactamente igual (los tests y el snapshot de SQL de `register` no cambian).

**Cómo funciona con el flag encendido**
1. `POST /api/auth/register` valida la forma del correo (`correoValido`) y que no esté registrado. Guarda el registro en `REGISTROS_PENDIENTES` con el **hash** (HMAC-SHA256 con `SESSION_SECRET`) de un código aleatorio de 6 dígitos, lo envía por Brevo y responde 202. En `USUARIOS` no se crea nada todavía. Si el envío falla, no queda nada guardado (502).
2. `POST /api/auth/register/verificar` con `{ correo, codigo }`:
   - Código correcto: crea el usuario con sus permisos (mismo SQL de siempre, ahora en `crearUsuario` de `lib/api/registro.js`) y borra el pendiente.
   - Primer error: avisa que queda 1 intento.
   - Segundo error, o pasados 5 minutos: borra el pendiente y el registro se descarta (410).
   - Dos errores simultáneos no regalan un intento: el UPDATE va condicionado al valor leído.
3. `POST /api/auth/register/reenviar`: código nuevo, que reinicia los 5 minutos y los intentos. Máximo 3 reenvíos y 60 s entre envíos (429). Volver a registrarse con el mismo correo también respeta esos 60 s.
4. Cada registro limpia los pendientes vencidos de cualquier correo, así no quedan datos de registros abandonados.
5. `/register`: el paso "Verifica tu correo" (`components/register/VerificarCorreo.jsx`) tiene contador de 5:00, aviso de intentos, "Reenviar código" (habilitado a los 60 s), "Cambiar correo" y vuelta automática al formulario cuando vence o se descarta.

**Base de datos**: `scripts/postgres/06_registros_pendientes.sql` (idempotente). `01_esquema.sql` y `02_indices.sql` actualizados para bases nuevas.

**Configuración**: `EMAIL_VERIFICATION`, `BREVO_API_KEY`, `EMAIL_REMITENTE` y, opcional, `EMAIL_REMITENTE_NOMBRE`. Documentado en `CLAUDE.md`. El envío usa la API HTTP de Brevo con `fetch`, sin dependencias nuevas.

**Tests**: 80 nuevos (reglas puras, correo y código, las tres rutas, rutas públicas con `AUTH_ENFORCED` y la pantalla con timers falsos). `npm test` (939 en verde), `npm run lint` y `npm run build` sin errores. No se envió ningún correo real: Brevo se simula en los tests. Se detectó un test intermitente ajeno a este cambio (BACKLOG DT-52).

**Riesgos pendientes**
- Para encenderlo, en orden: correr el script 06 en Supabase, cargar las variables de Brevo en Vercel, poner `EMAIL_VERIFICATION=true` y redesplegar. Probarlo primero con un correo propio.
- El pendiente guarda la contraseña en texto plano, igual que `USUARIOS` (BUGS S4 / DT-47). Se borra al verificar, al vencer o en la limpieza siguiente.
- Sin límite por IP: alguien puede pedir códigos para correos ajenos (como mucho uno por minuto y 4 en total por registro). El plan gratis de Brevo permite 300 correos por día.
- La espera de 60 s y el límite de reenvíos son por registro: registrarse de nuevo después de que se descarta vuelve a empezar.
- `crearUsuario` conserva un detalle del código anterior: el `SELECT` de menús confirma el INSERT del usuario antes de los permisos (el contrato de `lib/pg` confirma con autoCommit por defecto). No cambia con este trabajo.

## 2026-10-01 — Guardián: detalle y contador para el contacto, y chat usuario-guardián

Pedido explícito: cambia el comportamiento y el esquema. Sin feature flag, por decisión de la usuaria (activo directo).

**Base de datos** (`scripts/postgres/05_guardian_y_chats.sql`, idempotente, sin borrar datos; `01_esquema.sql` y `02_indices.sql` actualizados para bases nuevas)
- `GUARDIANES.USUARIO_ID_USU` (quién lo activó) y `CONTACTO_ID_USU` (el usuario contacto), con FK e índices. Los guardianes existentes completan el contacto por correo; quién lo activó queda en NULL.
- `MENSAJES.SOLICITUD_ID_SOL` y `GUARDIAN_ID_GUA`, con FK `ON DELETE CASCADE`, un CHECK de un solo chat por mensaje e índices. Resuelve BUGS F4.

**API**
- `POST /api/guardian` guarda `USUARIO_ID_USU` (sesión, o el `usuarioId` del body) y `CONTACTO_ID_USU`.
- `GET /api/guardian?email` suma `protegidoId` y `salida`. "pasajero" pasa a ser quien activó el guardián; para los viejos se sigue deduciendo como antes.
- `GET/POST /api/mensajes` aceptan `guardianId` además de `chatId` (no los dos a la vez). Los mensajes se filtran e insertan por chat.
- `GET /api/mensajes/chats` suma los chats de guardián del día, primero, y cada chat trae `tipo` y `clave`.
- Vigencia (decisión de la usuaria: ocultar, no borrar): el chat de viaje se ve hasta que termina el día del viaje y el de guardián, el día en que se activó. Después la consulta no lo encuentra: el GET devuelve `[]` y el POST, 404.

**Pantallas**
- Contacto (Guardián → "Soy Guardián"): tarjeta `DetalleGuardianContacto` con la persona protegida, la ruta, el conductor, la placa, el vehículo y la salida, el **mismo contador** (inicio + minutos estimados, con las extensiones que lleguen en el refresco de 10 s) y el botón "Enviar mensaje a …", que abre el chat en Mensajes. Si el tiempo venció, se ve como alerta aunque la persona protegida no haya registrado el estado.
- Persona protegida ("Viaje en Curso"): aviso "Puedes chatear con tu contacto de confianza durante el viaje" y botón "Chatear con mi guardián".
- Mensajes: los chats de guardián se listan como "Guardián: ruta (fecha)". `useChat` maneja los dos tipos (`lib/client/chats.js`).

**Tests**: 23 nuevos (API, IDOR, dominio, helpers de cliente y dashboard) y snapshots de SQL actualizados. `npm test` (859 en verde), `npm run lint` y `npm run build` sin errores. El script SQL lo corrió la usuaria en Supabase (2026-10-01); los tests no lo ejecutan (no hay Postgres local).

**Riesgos pendientes**
- **Orden de despliegue:** `05_guardian_y_chats.sql` ya está aplicado en Supabase. Cualquier otra base (por ejemplo, una de pruebas) tiene que correrlo **antes** de recibir este código: sin las columnas nuevas fallan el chat, la lista de chats y la activación del guardián.
- Los mensajes anteriores al script quedan sin chat y no se muestran (se conservan en la base).
- Con `AUTH_ENFORCED` apagado, quién activó el guardián sale del `usuarioId` que manda el cliente.
- Si la persona protegida tiene su propio guardián activo, no ve las tarjetas de los guardianes que cuida (`GuardianInicio` solo se muestra sin guardián activo; ya pasaba antes).
- Los guardianes no se finalizan solos: si la persona no marca "He llegado", la tarjeta del contacto sigue visible (en alerta) después de ese día.

## 2026-10-01 — Guardián: no se puede ser el propio contacto de confianza

Pedido explícito de cambiar el comportamiento (era un riesgo pendiente de la entrada siguiente).

**Qué se hizo**
- `lib/domain/guardian.js`: `esContactoPropio(correoContacto, correoUsuario)`, que compara sin importar mayúsculas ni espacios. Tests en `__tests__/lib/domain.test.js`.
- `lib/domain/constantes.js`: `CONTACTO_PROPIO` (código y mensaje: "No puedes ser tu propio contacto de confianza. Usa el correo de otra persona registrada en Bycar.").
- `app/api/guardian/route.js` (POST): después de buscar el usuario del correo, si su `ID_USU` es el del solicitante responde 400 con `codigo: 'CONTACTO_PROPIO'` y no inserta. El solicitante es el de la sesión si hay cookie; sin sesión (`AUTH_ENFORCED` apagado), el `usuarioId` del body, que el frontend ya mandaba. Reusa la consulta existente; no hay SQL nuevo.
- `useGuardian`: antes de llamar a la API compara el correo con el del usuario guardado y, si es el mismo, avisa sin hacer la request. Si la API igual responde `CONTACTO_PROPIO` (por ejemplo, otro formato del mismo correo), lo muestra en el toast y debajo del campo, igual que `CONTACTO_NO_REGISTRADO`.

**Tests**: 11 nuevos (6 de dominio, 2 de la API, 1 de IDOR con sesión, 2 del dashboard). `npm test` (836 en verde), `npm run lint` y `npm run build` sin errores.

**Riesgos pendientes**
- Con `AUTH_ENFORCED` apagado, el control del servidor depende del `usuarioId` que manda el cliente: alguien que llame a la API a mano sin ese campo lo saltea. Con el flag prendido usa la sesión y no se puede saltear.

## 2026-10-01 — Guardián: el contacto de confianza tiene que ser usuario de Bycar

Pedido explícito de cambiar el comportamiento. La regla ya existía en el servidor desde el commit inicial (`POST /api/guardian` devuelve 404 si el correo no está en `USUARIOS`); lo nuevo es cómo se le comunica al usuario.

**Qué se hizo**
- `lib/domain/constantes.js`: `CONTACTO_NO_REGISTRADO` (código y mensaje), compartido por la API y el cliente.
- `app/api/guardian/route.js`: el 404 ahora trae `codigo: 'CONTACTO_NO_REGISTRADO'` y el mensaje "El contacto de confianza debe ser un usuario registrado en Bycar. Pídele que cree su cuenta o usa el correo con el que se registró." Mismo status; cambia el texto de `error` y se agrega `codigo`. Sin cambios en el SQL.
- `ConfigurarGuardianModal`: debajo del correo se avisa "Debe ser el correo con el que tu contacto se registró en Bycar." Si la API lo rechaza, el aviso pasa a ser el error en rojo (`role="alert"`) y el campo se marca como inválido; se borra al editar el correo o al elegir otro viaje.
- `useGuardian`: con ese código, toast con el mensaje claro (sin el "Error (ID: …)") y `errorContacto` para el modal. Los demás errores siguen como antes.
- Sin feature flag: la restricción ya estaba activa en producción; solo cambian los textos.

**Tests**: 3 nuevos en `dashboard-guardian.test.jsx` y el de la API actualizado. `npm test` (825 en verde), `npm run lint` y `npm run build` sin errores.

**Riesgos pendientes**
- ~~Nada impide usar el propio correo como contacto de confianza.~~ Resuelto en la entrada anterior.
- La respuesta distingue "correo registrado / no registrado", así que permite averiguar si un correo tiene cuenta (ya pasaba antes). Con `AUTH_ENFORCED` exige sesión, pero no tiene límite de intentos.

## 2026-10-01 — Estilos de la landing acotados (sidebar del dashboard y admin)

**Qué se hizo**
- `app/page.jsx`: la landing va envuelta en `<div className="landing">` y todos sus selectores quedan bajo `.landing` (reset `*`, variables CSS, `nav`, `section`, `footer`, `.btn-red`, `.btn-ghost`, etc.). Solo `html` y `body` siguen globales; `body` ahora tiene `margin: 0` y colores literales, porque ya no lo cubren ni el reset ni las variables.
- Por qué: el `<style>` de la landing queda inyectado al navegar a otra página. Su `nav { position: fixed; top: 0 … }` convertía el menú del sidebar del dashboard (y el del admin) en una barra superior que tapaba el logo, y `.btn-red`, `section` y las variables `:root` pisaban estilos del dashboard.
- Snapshot de `page-animaciones` actualizado: cambian solo el wrapper y los selectores; el HTML es el mismo.

**Tests**: `npm test` (822 en verde), `npm run lint` y `npm run build` sin errores. En el navegador, la landing se ve igual y un `nav` o `.btn-red` fuera de `.landing` ya no toma sus estilos.

**Riesgos pendientes**
- `app/login/page.jsx` y `app/register/page.jsx` tienen el mismo problema con selectores globales (`*`, `h1`, `input`, `:root`), y del login se pasa directo al dashboard. Conviene acotarlos igual en tarea aparte.

## 2026-10-01 — Base de Supabase conectada

Misma rama `feat/migracion-postgres`. Sin cambios de código.

**Qué se hizo**
- Supabase (proyecto `lycoygclzvarcqaaneiq`, `us-west-2`) creado por la usuaria con `scripts/postgres/01–04` y la zona horaria `America/Bogota`.
- `.env.local` local (no versionado) con `DATABASE_URL` al Session pooler (`aws-0-us-west-2`, puerto 5432; la conexión directa es solo IPv6 y no llega desde esta red), `SESSION_SECRET` aleatorio y `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
- Decisiones (proyecto académico): no se migran los datos de Oracle (la base arranca de cero); se mantienen el admin `admin@bycar.co`/`admin` y la contraseña actual de la base. Riesgo aceptado anotado en BUGS S5.
- `AGENTS.md`: bloque regenerado por `next dev` (Next 16.3), se commitea tal cual.

**Verificado contra Supabase**
- Postgres 17.11, `TimeZone` = `America/Bogota` (hora de la base = hora local), 16 tablas, 18 índices, RLS en las 16, 1 120 municipios, 7 menús, 20 marcas.
- TLS 1.3 entre la app y el pooler, sin verificación del certificado (`sslmode=require&uselibpqcompat=true`).
- `scripts/verificar-consultas-auth.mjs --usuario 1`: OK. `next dev`: `menus`, `marcas`, `municipios` y `viajes` responden 200; login de admin OK (200 → `/admin`) y clave incorrecta → 401.

**Riesgos pendientes**
- Credenciales débiles y compartidas en el chat (admin y base): cambiarlas antes de cualquier uso real.
- El certificado de Supabase no se verifica: para hacerlo, descargar el CA (Database Settings → SSL Configuration) y usar `sslmode=verify-full&sslrootcert=…`.
- `.env.local` está solo en el worktree: al pasar a la carpeta principal hay que copiarlo.

## 2026-10-01 — `.env.example` y `fix_guardian` para Postgres

Misma rama `feat/migracion-postgres`. Pedido explícito de tocar `.env.example` (excepción a la regla 7).

**Qué cambió**
- `.env.example`: `DB_USER`, `DB_PASSWORD` y `DB_CONNECTION_STRING` pasan a `DATABASE_URL` (obligatoria), `DB_TIMEZONE` y `DB_POOL_MAX` (opcionales). Sin valores.
- `scripts/fix_guardian.mjs` reemplaza al `fix_guardian.js` local de Oracle: lee `DATABASE_URL` en vez de credenciales hardcodeadas y usa `ADD COLUMN IF NOT EXISTS` (se puede correr varias veces). Ahora está versionado. BUGS S7 resuelto.

**Tests corridos**
- Sin `DATABASE_URL`, el script termina con código 2 y un mensaje claro. El `ALTER` corrido dos veces en Postgres 17 (PGlite) agrega la columna `numeric` una sola vez, sin error.
- `npm test`, `npm run build` y lint: ver el commit.

**Riesgos pendientes**
- La copia vieja `scripts/fix_guardian.js` sigue en el checkout principal, con credenciales y excluida de git. Hay que borrarla a mano y rotar esa contraseña si se reutiliza en otro lado.

## 2026-10-01 — Migración de Oracle a PostgreSQL (Supabase)

Rama `feat/migracion-postgres`, desde `main` (`1e2e682`). Pedido explícito: levantar la regla de "BD fuera de alcance" y reemplazar `oracledb` por `pg` para esta tarea. Guía: `docs/MIGRACION_POSTGRES.md`.

**Qué cambió**
- `lib/db.js` usa un pool de `pg` con `DATABASE_URL`. El nuevo `lib/pg/` conserva el contrato de oracledb que usan las rutas: binds `:nombre`, columnas en MAYÚSCULAS salvo alias entre comillas, `rowsAffected`, `autoCommit`/`commit`/`rollback` con savepoint por sentencia (en Oracle un error solo deshace la sentencia), `''` como `NULL`, `NUMERIC`/`BIGINT` como número, `errorNum` de Oracle a partir del SQLSTATE y sesión en hora de Colombia.
- Rutas: solo el SQL propio de Oracle (`ROWNUM`, `SYSDATE`, `SYSTIMESTAMP`, `TRUNC(SYSDATE)`, `NVL`, `TO_CHAR(clob)` y el diccionario `user_*` → `information_schema`). `admin/permisos` detecta el duplicado por `errorNum` en vez del texto `ORA-00001`. Dejan de pasar `outFormat`.
- `scripts/postgres/01–04`: esquema (con RLS), índices, datos iniciales y el admin aparte. Los `.txt` de Oracle quedan como históricos.
- `scripts/verificar-consultas-auth.mjs` usa `DATABASE_URL` y una conexión sin `autoCommit`.
- Dependencias: `oracledb` desinstalado y `pg` 8.23 instalado.

**Tests corridos**
- `npm test`: 817 tests en 56 archivos, todos OK (antes 781 en 54). Nuevos: `__tests__/lib/pg/sql.test.js` y `conexion.test.js`. `db.test.js` se reescribió para `pg`. Los snapshots solo cambian en `outFormat` y en el SQL traducido; `permisos.test.js` simula el duplicado con `errorNum` 1.
- Integración fuera del repo: los route handlers reales contra Postgres 17 (PGlite) con los 4 scripts cargados, 11 casos: catálogos, registro (transacción) y login, publicar viaje con municipio y marca nuevos, solicitudes, chat, guardián (hora de Colombia, extensión, estado por texto), CRUD de `admin/tablas` (incluido `MENUS` en transacción y los errores de FK y de largo), `admin/permisos` (409) y las consultas de pertenencia en READ ONLY. Ahí apareció que `SET TRANSACTION READ ONLY` se perdía dentro del savepoint; quedó corregido (`0fdbcd3`).
- `npm run build`: OK. `npm run lint`: 3 errores y 5 warnings, los mismos de la línea base (DT-38, DT-51).

**Riesgos pendientes**
- No se probó contra Supabase real: SSL, pooler y zona horaria dependen de la configuración del proyecto (ver la guía).
- Los datos de producción que hoy están en Oracle hay que exportarlos e importarlos aparte (guía, sección 3).
- ~~`.env.example` con las variables de Oracle~~ y ~~`scripts/fix_guardian.js` con `oracledb`~~: resueltos en la entrada siguiente (pedido explícito).
- Diferencias de orden de textos y de largo de `VARCHAR` (BD-20), IDs con `Date.now()`/`MAX+1` (BD-21), conexión con el usuario `postgres` (BD-22).

## 2026-10-01 — Correcciones pendientes dentro del alcance

Rama `fix/correcciones-pendientes`, desde `main` (`402f064`).

**Qué cambió**
- **F41:** tocar el chat que ya está abierto no hace nada. Antes vaciaba la conversación hasta el siguiente refresco. Se invirtió el test de caracterización y se verificó que fallaba con el código anterior.
- **Logs:** los 4 `console.*` sueltos del servidor (`lib/auth/ownership.js`, `guard.js`, `session.js` y `auth/login`) pasan a `logWarn` / `logAlerta`, nuevos en `lib/log.js` y con tests. La salida es idéntica.
- **BUGS al día:** F7 ya estaba resuelto por DT-10 (`bff9b6b`), y F25 está mitigado detrás de `AUTH_ENFORCED` (`isViajeParticipant`).

**Tests corridos**
- `npx vitest run --maxWorkers=4`: 786 tests en 54 archivos, todos OK.
- `npm run build`: OK. `npm run lint`: 0 errores y 0 warnings.

**Riesgos pendientes (fuera del alcance de esta tarea)**
- Requieren cambiar SQL o la BD (regla 8): F2, F3, F4, F5, F10, F21, S4 y la parte de servidor de F28 (además necesita un proceso programado y el envío de correo).
- Requieren una persona: rotar las credenciales de S7 y S9 y limpiar el historial; prender `AUTH_ENFORCED` en producción (S1, S2, S3, S6, F25); cambiar la contraseña del admin del seed (S5).

## 2026-10-01 — Lint en verde (DT-38, DT-51) y obligatorio en CI

Rama `chore/lint-dt38`, desde `main` (`5abb90f`).

**Qué cambió**
- ESLint ignora `.claude/**`: recorría los worktrees de otras sesiones y su `.next`.
- DT-38, sin cambios de comportamiento:
  - Marcar los chats como leídos al entrar a Mensajes y las rutas como vistas al entrar a Mis Rutas ahora lo hace `navegar()`, no un efecto sobre `activePage`. Si el refresco llega estando en Mis Rutas, los estados quedan vistos en `aplicarMisRutas`.
  - El primer pedido del historial del chat lo hace `abrirChat`, y el efecto solo arma el refresco cada 3 s.
  - `useInView` declara `threshold` como dependencia.
- DT-51: `logout` y `expireSession` siguen con `location.assign` (la recarga completa es intencional), con la regla desactivada en esas dos líneas y el motivo en un comentario.
- CI: el paso de lint deja de ser informativo. `CLAUDE.md` actualiza la nota del lint.
- Bug nuevo registrado, sin corregir: **F41** (tocar el chat que ya está abierto lo vacía hasta 3 s).

**Tests corridos**
- Antes de tocar el código se agregaron 2 tests de caracterización (rutas vistas al refrescar estando en Mis Rutas; tocar el chat ya abierto), y se verificó que pasaban con el código anterior.
- Al final se reinstalaron las dependencias con `npm ci`, porque el `node_modules` local tenía `eslint-config-next` 16.2.4 en vez de 16.3.8 y por eso no aparecían los warnings de DT-51. Con las versiones del lockfile: `npx vitest run --maxWorkers=4` dio 784 tests en 54 archivos, todos OK; `npm run build` OK; `npm run lint` con 0 errores y 0 warnings.

**Riesgos pendientes**
- Con el lint obligatorio, cualquier warning nuevo hace fallar el CI de GitHub. Hoy no hay CI corriendo porque no se pusheó.

## 2026-10-01 — Fix de F40 (extender el guardián después de la alerta)

Rama `fix/f40-extender-tras-alerta`, desde `main` (`1e2e682`). Opción elegida: después de la alerta ya no se puede extender.

**Qué cambió**
- Cuando el tiempo se agota se cierra el modal de pre-alerta, y `reajustarTiempo` no hace nada si la alerta ya salió. Antes, "+15 min" registraba la extensión pero el contador quedaba congelado en 15:00 con "ALERTA ENVIADA" en pantalla. "He llegado" sigue disponible en el panel.

**Tests corridos**
- Primero se escribió un test nuevo en `dashboard-guardian.test.jsx` y se verificó que fallaba con el código anterior.
- `npx vitest run --maxWorkers=4`: 782 tests en 54 archivos, todos OK.
- `npm run build`: OK. `npm run lint`: en el código del repo, los mismos 3 errores y 3 warnings (DT-38). ESLint también recorre `.claude/worktrees/migracion-postgres`, un worktree de otra sesión, y duplica esos hallazgos y suma los de su `.next`. No es de este cambio.

**Riesgos pendientes**
- La extensión ya no se ofrece después de la alerta: si el viajero sigue en camino, solo puede confirmar la llegada.

## 2026-10-01 — Fix de F39 (contador del guardián)

Rama `fix/f39-contador-guardian`, desde `main` (`9719ed4`).

**Qué cambió**
- El temporizador del guardián calcula los segundos que faltan contra la hora de vencimiento (`segundosHasta` en `lib/client/cuentaRegresiva.js`) en vez de descontar 1 por tick. Con la pestaña en segundo plano ya no se atrasan el contador, la pre-alerta ni la alerta: el desfase tras 5 min oculto pasó de 295 s a 0 s. Extender suma 15 min al vencimiento.
- Nuevo bug registrado, sin corregir: **F40** (extender después de la alerta deja el contador congelado).

**Tests corridos**
- Primero se escribieron 4 tests (2 de `segundosHasta` y 2 del dashboard con la pestaña en segundo plano) y se verificó que fallaban con el código anterior.
- `npx vitest run --maxWorkers=4`: 781 tests en 54 archivos, todos OK. Los tests del temporizador ahora falsean también `Date`; ningún valor esperado cambió.
- `npm run build`: OK. `npm run lint`: 3 errores y 3 warnings, los mismos de antes (DT-38).
- `npm run perf:dashboard`: desfase 0 s; commits/s y ms de render iguales.

**Riesgos pendientes**
- Si el reloj del dispositivo se cambia a mano durante el viaje, el contador lo sigue (antes lo ignoraba).
- F40 y F28 (la alerta depende de que el dashboard esté abierto) siguen abiertos.

## 2026-10-01 — DT-34 paso 3 (hooks del dashboard) y DT-35 (temporizador del guardián)

Rama `refactor/dashboard-hooks`, desde `main` (`0d7add3`). Era la única fase que había quedado esperando la integración (sesiones 4 y 7).

**Qué cambió**
- `useGuardian`, `useChat` y `useRutas` en `hooks/dashboard/`: el estado y las llamadas a la API de cada dominio salen de `app/dashboard/page.jsx` (860 → 555 líneas). Sin cambios de comportamiento.
- DT-35: el tick del guardián ya no vuelve a renderizar el dashboard entero. Los segundos restantes viven en `lib/client/cuentaRegresiva.js` y solo `ContadorGuardian` se suscribe. En Inicio, commits/s 1,1 → 0,1 y `normalizar()`/s 1 125 → 102 (`docs/PERFORMANCE.md`).
- `MENSAJE_SIN_SESION` pasa a `lib/client/usuario.js`, compartido por la página y `useRutas`.

**Tests corridos (antes de cada commit)**
- `npx vitest run --maxWorkers=4`: 777 tests en 54 archivos, todos OK (773 previos + 4 de `cuentaRegresiva`). Los 98 tests del dashboard no se tocaron.
- `npm run build`: OK.
- `npm run lint`: 3 errores y 3 warnings, los mismos de antes (DT-38). Dos errores y un warning se mudaron de la página a `useChat` y `useRutas` junto con su código.
- `npm run perf:dashboard`: 3 corridas después del cambio, comparadas con la línea base del mismo día.

**Riesgos pendientes**
- F39 sigue abierto a propósito: el contador descuenta 1 por tick y se atrasa con la pestaña en segundo plano. Va como fix aparte.
- Sin revisión visual en el navegador: no hay BD local para levantar el dashboard con datos.

## 2026-10-01 — Integración de las ramas de deuda técnica y bugs

Rama `integracion/2026-10-01` (worktree `../bycar_colombia-integracion`), creada desde `main` (`1e7f479`). Un merge `--no-ff` por rama, con la suite completa después de cada uno.

**Orden de integración**
1. `mejoras/backlog-pendiente` (fast-forward): bloques 1 a 3 de deuda técnica, caracterización, F34 y DT-06.
2. `fix/frontend-bugs` (sesión 3): F33, F35, F36, F37 y DT-49.
3. `chore/deps-seguridad` (sesión 8): dependencias y S5. Conflicto en `package.json`: `@vitest/coverage-v8` quedó en `^5.0.3`, la misma versión que `vitest` (DT-49 lo exige); el lockfile solo suma las dependencias de cobertura.
4. `chore/dt46-rutas-admin` (sesión 5): DT-46.
5. `refactor/organizacion` (sesión 4): DT-43, DT-38 parcial y DT-34 pasos 2 y 4.
6. `fix/frontend-bugs-2`: F1, F8, F9, F28 (parcial), F29, F30, F31 y E6.
7. `fix/api-backlog`: S8, E1, E2, E4, E5, DT-31 y los bugs de API.
8. `mejoras/varios` (sesión 6): DT-45.
9. `perf/mediciones` (sesión 7): DT-33 y benchmarks. Su bug «F38» (el contador del guardián se atrasa en segundo plano) chocaba con el F38 de la sesión 3: quedó renumerado como **F39**, también en `docs/PERFORMANCE.md`.

Después de integrar se corrigió **F38** (finalizar y extender el guardián no revisaban el `PUT`).

**Conflictos:** solo en `docs/` y `package.json`. El código se integró sin conflictos (los fixes del dashboard están en funciones que DT-34 no movió). En los docs se unieron las filas por ID, conservando el estado más avanzado; F10, E3 y E5 se corrigieron a mano para no nombrar rutas eliminadas.

**Tests corridos (después de cada merge)**
- `npx vitest run --maxWorkers=2`: al final, 773 tests en 53 archivos, todos OK.
- `npm run build`: OK.
- `npm run lint`: 3 errores y 5 warnings. Los 3 errores son lo que queda de DT-38; 2 de los warnings vienen de la regla nueva de `eslint-config-next` 16.3 (DT-51).

**Riesgos pendientes**
- `main` local todavía no apunta a esta rama: falta el fast-forward y decidir cómo unir la historia con `github.com/camilahdez99/bycar_colombia`, que no comparte historia con este repo.
- Antes del deploy: configurar `ADMIN_EMAIL` y `ADMIN_PASSWORD` (sin ellas el admin queda deshabilitado) y ejecutar `docs/ROLLOUT_AUTH.md`.
- Abiertos: F39 y DT-35 (contador del guardián), F28 del lado del servidor, DT-34 paso 3 (hooks), los 3 errores de lint de DT-38 y lo que requiere la BD.

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
## 2026-10-01 — DT-46: eliminar las rutas admin sin consumidor

Rama `chore/dt46-rutas-admin` (worktree `../bycar_colombia-dt46`, desde `7e19e1b`), en coordinación con la sesión que trabaja la API en `fix/api-backlog`: esa rama no toca estos archivos.

**Qué cambió**
- Se borraron `app/api/admin/{usuarios,conductores,vehiculos,viajes}/route.js`, sus 4 archivos de test y sus snapshots.
- `auth-enforcement.test.js`: se quitaron sus entradas; cubre 22 handlers (antes 36).
- Docs: tabla de rutas de `ARCHITECTURE.md`; F16, F17, F18 y F26 pasan a "no aplica"; F19, F10, S4, E3, E5, DT-47 y BD-02/05/07/09/14/16 ya no citan las rutas borradas.

**Evidencia de que no se usaban**
- Ningún `fetch` del frontend (literal ni con template) apunta a esas rutas: todo va a `admin/tablas` y `admin/permisos`.
- `next.config.mjs` no tiene rewrites ni redirects; `proxy.js` y `scripts/` no las mencionan.
- En el historial de git, sus únicos consumidores fueron `FormularioConductor.jsx` y `FormularioVehiculo.jsx`, que no se importaban y se borraron en DT-20 (`c80d364`).

**Cambio de comportamiento a propósito**
- `/api/admin/usuarios`, `/conductores`, `/vehiculos` y `/viajes` responden 404. Aprobado por la usuaria.

**Tests corridos**
- `vitest run --maxWorkers=4`: 617 tests en 44 archivos, todos OK. Los 121 que faltan respecto de 738 son los de las rutas borradas.
- `npm run build`: OK; las 4 rutas ya no aparecen.
- Lint: 5 errores y 3 warnings, igual que la línea base.

**Riesgos pendientes**
- No se pudo verificar desde el código si hay consumidores externos (Postman, integraciones). Si aparecen 404 en los logs de producción para esas URL, el commit se puede revertir sin afectar al resto.
- Con `npm test` a secas (48 workers) fallan entre 19 y 28 tests de UI por timeout, distintos en cada corrida, aun sin cambios; con `--maxWorkers=4` pasan. Conviene fijar `maxWorkers` o subir los timeouts en `vitest.config.mjs` en una tarea aparte.
## 2026-10-01 — Bugs del frontend (dashboard y panel admin)

Rama `fix/frontend-bugs-2` (worktree `../bycar_colombia-frontend2`), creada sobre `refactor/organizacion` (`47e7c0a`, dashboard dividido por la sesión 4). Un commit por bug.

**Qué cambió (fixes: cambian el comportamiento a propósito)**
- **F1:** sin usuario, publicar viaje y solicitar cupo avisan "Inicia sesión para continuar" y no llaman a la API (antes usaban el ID 1).
- **F8:** `formatCurrency` no falla con null.
- **F9:** el correo va codificado al pedir las alertas del guardián.
- **F28 (parte cliente):** al recargar con el tiempo vencido se registra la alerta con un PUT, una sola vez. Sigue abierto el resto (sin proceso en el servidor).
- **F29:** un mensaje de chat que no se pudo enviar se saca de la conversación, vuelve al input y se avisa.
- **F30:** la ruta recién publicada va primera en Mis Rutas.
- **F31:** el panel admin identifica cada fila por la PK de su tabla (`lib/client/clavesPrimarias.js`).
- **E6:** si falla la recarga después de guardar, se avisa eso (no "Error de red") y el modal se cierra.

**Tests corridos (antes de cada commit)**
- `npx vitest run --maxWorkers=2`: de 743 a 750 tests, 50 archivos, todos OK. `npm run build`: OK.
- `npm run lint`: 3 errores y 3 warnings, la línea base de `refactor/organizacion` (la sesión 4 ya corrigió parte de DT-38).

**Riesgos pendientes**
- F38 (finalizar y extender el guardián sin revisar el PUT) se hace después de integrar `fix/frontend-bugs`, porque toca las mismas funciones que su fix de F36.

## 2026-10-01 — Organización y legibilidad: componentes, lint y división del dashboard

Rama `refactor/organizacion` (worktree `../bycar_colombia-organizacion`, desde `7e19e1b`). Un commit por lote.

**Qué cambió**
- `cf32433` DT-43: una sola carpeta de componentes. `app/components/admin/PermisosManager.jsx` → `components/admin/`, `components/admin/HydrationWrapper.jsx` → `components/`; el test de `PermisosManager` pasa a `__tests__/components/admin/`. `app/` queda solo con rutas.
- `0b9b5b1` DT-38 (parcial): `DynamicForm` reinicia el formulario durante el render cuando cambian `columns` o `initialData` (antes, un efecto con un render extra vacío); `HydrationWrapper` usa `useSyncExternalStore`. Tests nuevos para ambos, que pasan con el código anterior y con el nuevo.
- `f686ee7` DT-34 (paso 2 parcial): `Autocomplete` a `components/dashboard/`, tal cual y con el fix de F34.
- `e5e2be5` DT-34 (paso 2 parcial): `DetallesViajeModal` a `components/dashboard/`, con el mismo markup.
- `71bcf65`, `4f6489a` DT-34 (paso 2): `PreAlertaGuardianModal` y `PublicarViajeModal`. Los 4 modales viven en archivos propios.
- `978f0b3`, `e4a2a96`, `0487823`, `0428409` DT-34 (paso 4): una pestaña por componente: `MisRutasTab`, `SolicitudesTab`, `MensajesTab`, `InicioTab`, `BuscarTab` y el guardián en `GuardianEnCurso`, `GuardianInicio` y `ConfigurarGuardianModal`. Son solo de presentación: reciben datos y callbacks. `InicioTab` recibe el nombre ya resuelto y los permisos como booleanos, así no conoce columnas de Oracle (DT-42).
- `app/dashboard/page.jsx` pasa de 1 255 a 816 líneas.

**Lo que no se hizo y por qué**
- Formateo: el proyecto no tiene Prettier ni otro formateador, y agregarlo es una dependencia nueva (regla 6). Propuesta: `prettier` como devDependency con `singleQuote: true`, `printWidth: 100` y `eslint-config-prettier`, aplicado en un commit propio de solo formato. Requiere confirmación.
- Valores mágicos: ya estaban centralizados (DT-08, DT-09). Las piezas extraídas no agregan nuevos.
- DT-34 paso 3 (hooks por dominio) y el resto de DT-38 (3 errores de lint en los efectos del dashboard): mueven o cambian justo las funciones y efectos que modifican `fix/frontend-bugs` (F35–F37) y `perf/mediciones` (DT-33). Se retoman cuando esas ramas estén integradas.
- DT-42 (normalizar el usuario del login) cambia el contrato de la API: requiere confirmación.

**Tests corridos (en cada lote)**
- `npm test`: 743 tests, 49 archivos, todos OK: 738 de la base más 5 nuevos (3 de `DynamicForm`, 2 de `HydrationWrapper`).
- `npm run build`: OK.
- `npm run lint`: de 5 errores y 3 warnings a 3 errores y 3 warnings. Ninguno nuevo.

**Riesgos pendientes**
- `HydrationWrapper`: en una navegación del lado del cliente (sin hidratación) los hijos se renderizan en el primer render en lugar de después de montar. En el servidor y durante la hidratación sigue devolviendo vacío.
- Con varias sesiones corriendo `vitest` en la misma máquina, una corrida informó 47 de 49 archivos sin marcar fallas; se repitió y dio 49/49. Conviene mirar el total de archivos y no solo "passed".
- La rama sale de `7e19e1b` y no está integrada. Merge de prueba (`git merge-tree`, sin tocar ramas): `app/dashboard/page.jsx` se integra automáticamente con `fix/frontend-bugs` y con `perf/mediciones`, también las tres juntas; con `fix/api-backlog` no hay conflictos. Solo chocan `CHANGELOG.md` y `BACKLOG.md`, porque todas las ramas agregan arriba: hay que resolverlos a mano.
- Las pestañas extraídas no tienen tests propios: las cubren los tests del dashboard de punta a punta.
## 2026-10-01 — API: errores seguros, validación de entrada y bugs de la API

Rama `fix/api-backlog` (worktree `../bycar_colombia-api`), creada desde `7e19e1b`. Un commit por cambio lógico. Trabajo coordinado con las otras sesiones: frontend en `fix/frontend-bugs` (sesión 3), DT-46 en `chore/dt46-rutas-admin` (sesión 5), dependencias y S5 en `chore/deps-seguridad` (sesión 8), organización en `refactor/organizacion` (sesión 4) y varios en `mejoras/varios` (sesión 6).

**Qué cambió (cambios de comportamiento a propósito: son fixes)**
- **S8 / DT-06:** los 500 ya no devuelven el texto de Oracle. El body lleva un mensaje seguro (`lib/api/errores.js`).
- **E1:** en `admin/tablas`, un nombre de tabla o un JSON inválidos → 400 (antes 500 sin control).
- **E2:** `tablas` y `guardian` cierran con `closeConnection`; un fallo al cerrar ya no tapa la respuesta.
- **E4:** un resultado sin `rows` se trata como vacío en `mensajes` y `guardian` (antes 500).
- **E5:** `guardian` y `solicitudes` validan antes de abrir la conexión.
- **DT-31:** validación de entrada en todas las rutas de usuario y en `admin/tablas` y `admin/permisos` (`lib/domain/validadores.js`, `lib/api/validacion.js`). Resuelve F6, F20, F22, F23 y F24: IDs no enteros, estados fuera de catálogo, NaN en puestos, valor y tiempo, placas de más de 6 caracteres (antes se recortaban y podían colisionar), `extraTiempo: null` y filtros de solo espacios.
- **`admin/tablas`:** F12 (el INSERT en MENUS sin `ID_ENU` ahora se confirma), F13 (tabla sin PK → 400), F14 (id como texto en los tres métodos) y F15 (sin columnas válidas → 400).
- **F19:** `rowsAffected = 0` → 404 en `admin/tablas`, `solicitudes` y `guardian`.
- Un body que no es JSON → 400 en `solicitudes`, `guardian`, `mensajes` y `permisos` (antes 500).
- El texto del SQL no cambió en ningún commit: los snapshots solo cambian el tipo del id en `tablas`.
- DT-03 y DT-07 quedan cerrados. Docs: `ARCHITECTURE.md` (validación y errores; `PUT guardian` sin id ahora es 400) y `CLAUDE.md` (convención de validación y errores).

**Tests corridos (antes de cada commit)**
- `npx vitest run --maxWorkers=2` (suite completa): de 738 a 850 tests, 50 archivos, todos OK. Con los workers por defecto, los tests de UI superan el timeout por la carga de la máquina (varias sesiones corriendo suites a la vez), así que se limitó el paralelismo.
- `npm run build`: OK. `npm run lint`: 5 errores y 3 warnings, igual que la línea base.

**Riesgos pendientes**
- El dashboard muestra en un toast el `error` de la API: ahora el usuario ve los mensajes de validación (por ejemplo, «La placa debe tener entre 1 y 6 letras o números») en lugar de un error genérico o de un viaje guardado con NaN.
- Integración: esta rama y `chore/dt46-rutas-admin` tocan `__tests__/app/api/auth-enforcement.test.js`, `docs/BUGS.md` y `docs/BACKLOG.md`. Al mergear puede haber conflictos de texto, no de lógica.
- Siguen abiertos los bugs que requieren SQL o la BD: F2–F5, F10, F21, S4 y S5 (este último lo está tomando la sesión 8).
## 2026-10-01 — DT-45: la landing pasa a server component

Rama `mejoras/varios`. Dos commits: caracterización (`9f671b7`) y refactor (`b761156`).

**Qué cambió**
- `app/page.jsx` ya no es `'use client'`: los estilos (~320 líneas de CSS), el hero estático, los títulos de sección y el footer se renderizan en el servidor y salen del bundle del cliente.
- Nuevas islas de cliente en `components/landing/`: `LandingNav` (sombra con scroll y navegación), `HeroTexto` (entrada a los 80 ms), `PasosAnimados`, `GuardianesAnimados` y `CtaFinal` (cada una con su `IntersectionObserver`), más el hook `useInView`. La lógica se copió sin cambios.
- `Counter` se mudó tal cual a `components/landing/Counter.jsx`: no se usa en ningún lado. No se borró porque requiere confirmación.

**Tests corridos**
- Nuevo `__tests__/app/page-animaciones.test.jsx` (7 tests), escrito y verde ANTES del refactor: snapshot del HTML renderizado, entrada del hero, nav con scroll, cada sección se anima una sola vez al entrar en pantalla, logo y hover de "Ya tengo cuenta". El snapshot no cambió con el refactor: el DOM es idéntico.
- `npx vitest run --maxWorkers=3`: 745 tests, 49 archivos, todos OK.
- `npm run build`: OK; `/` sigue siendo estática.
- `npm run lint`: 5 errores y 3 warnings, igual que la línea base (el warning de `useInView` se mudó de archivo).

**Riesgos pendientes**
- No hay tests visuales: el snapshot cubre el DOM, no el render en el navegador. Conviene una mirada manual a la landing.
- La sesión de performance mide el antes y el después del bundle (`docs/PERFORMANCE.md` de su rama).
- Con los workers por defecto, `npm test` da timeouts falsos cuando la máquina está cargada (hasta 30 tests). Con `--maxWorkers=3` la suite es estable.
## 2026-10-01 — Performance: mediciones, DT-33 y evaluación de DT-26 y DT-45

Rama `perf/mediciones` (worktree `../bycar_colombia-performance`), sobre `7e19e1b`. Detalle y números en `docs/PERFORMANCE.md`.

**Qué cambió**
- `bench/`: benchmarks reproducibles (`npm run perf:dashboard`, `npm run perf:front`) para polling (DT-33), temporizador del guardián (DT-35) y carga del front (DT-26, DT-41, DT-45). Los resultados quedan en `bench/resultados/` (ignorado).
- DT-33 (✅ parcial): `lib/client/intervaloVisible.js` pausa el refresco de 10 s y el chat de 3 s con la pestaña oculta y refresca al volver. Pestaña oculta: de 12 y 32 req/min a 0. Visible: sin cambios.
- DT-26 acotado (fuentes con `<link>` en vez de `@import`): probado y **revertido**, la mejora queda dentro del ruido y por debajo del 10 %. Queda el test de caracterización del layout.
- DT-45 (otra sesión, rama `mejoras/varios`): medido, −1,6 % de JS en `/`. No llega al 10 %.
- `vitest.config.mjs`: compila como JSX los `.js` del proyecto (necesario para testear `app/layout.js`).
- Registrados F39 (el contador del guardián se atrasa en segundo plano: 295 s en 5 min) y BD-19 (historial de chat completo cada 3 s).

**Cambio de comportamiento a propósito**
- Con la pestaña del navegador oculta, el dashboard no consulta la API. Al volver, refresca enseguida. Los badges y el chat se actualizan al volver y no mientras está oculta.

**Tests corridos**
- `npm test` (con `--maxWorkers=4`): 748 tests, 51 archivos, todos OK. Nuevos: 3 del layout, 5 de `iniciarIntervaloVisible` y 2 de polling del dashboard (fallan sin el cambio).
- `npm run build`: OK.
- Lint: sin errores nuevos (en `app/dashboard/page.jsx` siguen los 3 de la línea base).

**Riesgos pendientes**
- DT-35 y DT-41 quedan pendientes: chocan con `refactor/organizacion` (DT-34, DT-38) y con `fix/frontend-bugs` (F35/F36 tocan el temporizador). Hay que hacerlos después de integrar esas ramas. Línea base de DT-35: 1,1 commits/s del dashboard y 1 125 llamadas a `normalizar()`/s.
- Con 8 workers en paralelo, la suite tuvo 6 a 28 timeouts de 5 s por carga de la máquina (hay varias sesiones compilando a la vez). Con `--maxWorkers=4` pasa entera.
- La latencia de la API no se midió: no hay BD local. El cuello de botella conocido es BD-06 (sin pool).
- Los números F39 (originalmente F38) y BD-19 podían chocar con los que asignen otras ramas en paralelo: revisarlos al integrar.

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
