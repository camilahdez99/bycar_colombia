# Arquitectura — Bycar

Plataforma de carpooling intermunicipal (Colombia). Relevamiento inicial: 2026-09-28.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router), JavaScript (sin TypeScript) |
| UI | React 19, Tailwind 4 + daisyUI, `lucide-react`, `react-hot-toast`; mucho CSS inline vía `<style>` en páginas |
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
  components/admin/     PermisosManager
  api/**/route.js       Route handlers (ver abajo)
components/             DynamicForm (form a partir de metadata de columnas), admin/*
lib/db.js               getConnection()
lib/municipios.js       Lista estática de 1021 municipios
scripts/                DDL/DML de referencia (.txt) y scripts sueltos de mantenimiento
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

Limitaciones vigentes:
- El rol admin sale del login hardcodeado (`admin@bycar.co`); el admin no tiene `userId`.
- **IDOR (S6) sigue abierto:** con sesión válida, las rutas todavía confían en el `usuarioId`, `chatId` o `senderId` que manda el cliente.
- El frontend sigue guardando el usuario en `localStorage` para mostrar datos. La cookie la envía el navegador de forma automática.
- El dashboard, `/admin` y `PermisosManager` hacen todas sus llamadas con `fetchConSesion` (`lib/client/sessionFetch.js`). Ante un 401 limpia `localStorage` y navega a `/login`, una sola vez por carga de página. Todo `fetch` nuevo del frontend a la API debería usarlo.

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

Las rutas `admin/usuarios`, `admin/conductores`, `admin/vehiculos` y `admin/viajes` no son usadas por ninguna UI actual (sus formularios `components/admin/Formulario*.jsx` no se importan).

## Frontend

- `dashboard/page.jsx` consume casi toda la API; hace polling cada 10 s y cada 3 s en el chat.
- `admin/page.jsx` usa `/api/admin/tablas` + `DynamicForm` + `PermisosManager`.

## Candidatos a tests unitarios (lógica pura)

- `app/dashboard/page.jsx`: `normalizar` (:8), `formatTiempo` (:448), `formatCurrency` (:454), `getBadgeCount` (:627)
- `app/admin/page.jsx`: `getRowId` (:214)
- `components/DynamicForm.jsx`: `typeForColumn` (:44)
- `app/api/admin/tablas/route.js`: `sanitizeTable` (:6)
- Lógica embebida en handlers (extraer con tests previos): mapa de estados en `solicitudes` (:46-58), limpieza de placa/puestos/valor en `viajes` (:147-174), cálculo de receptor en `mensajes` (:87-88)

Los route handlers dependen de `getConnection`; para caracterizarlos hay que mockear `@/lib/db` con `vi.mock`.
