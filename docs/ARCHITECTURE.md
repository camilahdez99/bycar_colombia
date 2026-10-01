# Arquitectura — Bycar

Plataforma de carpooling intermunicipal (Colombia). Relevamiento inicial: 2026-09-28.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router), JavaScript (sin TypeScript) |
| UI | React 19, Tailwind 4 (sin config JS; solo `globals.css`), `lucide-react`, `react-hot-toast`; mucho CSS inline vía `<style>` en páginas |
| Datos | Oracle (`oracledb` 6), conexión por request en `lib/db.js` (sin pool, `autoCommit` global = true) |
| Tests | Vitest + jsdom + Testing Library (`__tests__/`) |

Variables de entorno: `DB_USER`, `DB_PASSWORD`, `DB_CONNECTION_STRING`.

## Estructura

```
app/
  page.jsx              Landing estática (→ /login, /register)
  login/ register/      Formularios de auth
  dashboard/page.jsx    App principal del usuario (monolito ~grande, client component)
  admin/page.jsx        CRUD genérico sobre tablas + gestor de permisos
  api/**/route.js       Route handlers (ver abajo)
components/             Componentes React reutilizables (única carpeta; app/ solo tiene rutas)
  HydrationWrapper.jsx  Renderiza los hijos recién después de montar (dashboard y admin)
  DynamicForm.jsx       Form a partir de metadata de columnas (admin)
  admin/                PermisosManager
  dashboard/            Piezas extraídas de app/dashboard/page.jsx: Autocomplete, DetallesViajeModal
lib/db.js               getConnection()
lib/log.js              logError / logInfo: logs en una línea JSON
lib/api/connection.js   closeConnection(): cierre de conexión común de los handlers
lib/domain/             Reglas puras y constantes del dominio (estados, perfil, solicitudes, viajes, mensajes)
lib/api/cache.js        Caché HTTP opcional de catálogos (CATALOG_CACHE_SECONDS)
lib/client/             Código de navegador: fetchConSesion, logout, formato, usuario, badges
scripts/                DDL/DML de referencia y utilidades (ver scripts/README.md)
.github/workflows/      CI: tests, build y lint informativo
```

## Sesión y autorización

Desde 2026-09-28 hay autenticación en el servidor, **detrás del feature flag `AUTH_ENFORCED`** (apagado por defecto).

| Pieza | Archivo | Qué hace |
|---|---|---|
| Sesión | `lib/auth/session.js` | Cookie `bycar_session`: JWT HS256 (`jose`) con `{ userId, role }`, httpOnly, sameSite lax, 7 días. Requiere `SESSION_SECRET` (≥ 32 caracteres). |
| Guard | `lib/auth/guard.js` | `authorize(req, { role })` → 401 / 403 / null. Con el flag apagado siempre devuelve null. |
| Login / logout | `app/api/auth/login`, `app/api/auth/logout` | El login emite la cookie (solo si hay `SESSION_SECRET`), sin cambiar el body. El logout la borra. |
| Proxy | `proxy.js` | Redirige `/admin` (sin rol admin) y `/dashboard` (sin sesión) a `/login`. Es un chequeo optimista; la autorización real está en cada handler. |

Matriz de acceso con `AUTH_ENFORCED=true`:

| Rutas | Requisito |
|---|---|
| `auth/*`, `marcas`, `municipios`, `menus` | públicas |
| `viajes*`, `solicitudes*`, `mensajes*`, `guardian` | sesión |
| `admin/*` | rol admin |
| `GET admin/permisos?usuarioId=N` | admin, o el propio usuario N (lo usa el dashboard) |

### Pertenencia de recursos (IDOR)

Con `AUTH_ENFORCED`, además de la sesión, cada ruta de usuario verifica que el recurso sea del usuario (`lib/auth/ownership.js`). Si no lo es, responde 403 y deja un log `ownership_denied`. El admin saltea este chequeo.

| Ruta | Regla |
|---|---|
| `GET mis-rutas`, `recibidas`, `chats`, `guardian?usuarioId` | `usuarioId` = sesión |
| `POST viajes`, `POST solicitudes` | `usuarioId` del body = sesión |
| `GET/POST mensajes` | ser pasajero o conductor del chat; en POST, además, `senderId` = sesión |
| `PUT solicitudes` | el conductor acepta o rechaza (2, 3), el pasajero cancela (4); cualquier otro estado, solo el admin |
| `POST guardian` | participar del viaje: ser el conductor o un pasajero con solicitud aceptada |
| `PUT guardian` | participar del viaje del guardián; sin `id` responde 403 |
| `GET guardian?email` | el correo es el de la sesión (sin distinguir mayúsculas) |

Las consultas nuevas de solo lectura viven en `lib/auth/ownershipQueries.js` y están fijadas por snapshot. `checkOwnership` solo las ejecuta con el flag prendido y para usuarios no admin.

`__tests__/app/api/idor.test.js` exige que cada handler de usuario tenga una regla declarada.

Limitaciones vigentes:
- El rol admin sale del login hardcodeado (`admin@bycar.co`); el admin no tiene `userId`.
- El frontend sigue guardando el usuario en `localStorage` para mostrar datos. La cookie la envía el navegador de forma automática.
- El dashboard, `/admin` y `PermisosManager` hacen todas sus llamadas con `fetchConSesion` (`lib/client/sessionFetch.js`). Ante un 401 limpia `localStorage` y navega a `/login`, una sola vez por carga de página. Todo `fetch` nuevo del frontend a la API debería usarlo. Excepción: `app/login` y `app/register` usan `fetch` directo, porque ahí un 401 significa credenciales inválidas y `expireSession` recargaría la página.

## API

L = lectura, E = escritura.

| Ruta | Métodos | Propósito | Tablas |
|---|---|---|---|
| `auth/login` | POST | Valida credenciales, devuelve user + redirect | USUARIOS (L) |
| `auth/register` | POST | Crea usuario y le da permiso a todos los menús (transacción) | USUARIOS, PERMISOS (E), MENUS (L) |
| `admin/tablas` | GET POST PUT DELETE | CRUD genérico sobre cualquier tabla (`user_tables`) | todas |
| `admin/permisos` | GET POST DELETE | Asignar / revocar menús por usuario | PERMISOS (L/E) |
| `admin/usuarios` | GET POST PUT DELETE | CRUD usuarios | USUARIOS |
| `admin/conductores` | GET POST(no-op) DELETE | Lista conductores; borra sus vehículos y viajes | USUARIOS, VEHICULOS, VIAJES |
| `admin/vehiculos` | GET POST PUT DELETE | CRUD vehículos | VEHICULOS |
| `admin/viajes` | GET PUT DELETE | Viajes con pasajeros; cambiar estado / borrar | VIAJES (+ lecturas) |
| `guardian` | GET POST PUT | Alertas del "guardián de ruta"; activar, cambiar estado o tiempo | GUARDIANES (L/E) |
| `marcas`, `municipios`, `menus` | GET | Catálogos | L |
| `mensajes` | GET POST | Chat por solicitud (`ID_SOL`) | MENSAJES (L/E) |
| `mensajes/chats` | GET | Chats de solicitudes aceptadas del usuario | L |
| `solicitudes` | POST PUT | Crear solicitud de viaje; aceptar/rechazar | SOLICITUDES (E) |
| `solicitudes/recibidas` | GET | Solicitudes pendientes para el conductor | L |
| `viajes` | GET POST | Buscar viajes; publicar (crea municipio/marca/vehículo al vuelo) | VIAJES, VEHICULOS, MUNICIPIOS, MARCAS |
| `viajes/mis-rutas` | GET | Viajes publicados y solicitados por el usuario | L |

Las rutas `admin/usuarios`, `admin/conductores`, `admin/vehiculos` y `admin/viajes` no son usadas por ninguna UI actual (BACKLOG DT-46).

## Frontend

- `dashboard/page.jsx` consume casi toda la API; hace polling cada 10 s y cada 3 s en el chat.
- `admin/page.jsx` usa `/api/admin/tablas` + `DynamicForm` + `PermisosManager`.

## Logs

Los handlers registran con `lib/log.js`: `logError('api_error', error, { route: 'GET /api/x' })`. Cada log es una línea JSON con `event`, el contexto y, del error, solo `name`, `message`, `code` y `errorNum` (sin stack). `lib/auth` emite el mismo formato. No se loguean contraseñas, tokens ni cookies.

## Candidatos a tests unitarios (lógica pura)

Ya extraídos y con tests (2026-09-30): los helpers del dashboard (`lib/client/`) y la lógica de solicitudes, viajes y mensajes (`lib/domain/`).

Pendientes:
- `app/admin/page.jsx`: `getRowId`
- `components/DynamicForm.jsx`: `typeForColumn`
- `app/api/admin/tablas/route.js`: `sanitizeTable`

Los route handlers dependen de `getConnection`; para caracterizarlos hay que mockear `@/lib/db` con `vi.mock`.
