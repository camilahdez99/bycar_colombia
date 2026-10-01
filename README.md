# Bycar

Plataforma de carpooling intermunicipal en Colombia: los conductores publican viajes, los pasajeros los buscan y solicitan cupo, se coordinan por chat y pueden activar un "guardián de ruta" que alerta a un contacto de confianza.

## Stack

Next.js 16 (App Router, JavaScript) · React 19 · Tailwind 4 · PostgreSQL (Supabase) con `pg` · Vitest + Testing Library.

## Requisitos

- Node.js 24 (es la versión con la que se prueba el proyecto).
- Una base PostgreSQL (Supabase) creada con los scripts de `scripts/postgres/` (ver `docs/MIGRACION_POSTGRES.md`).

## Variables de entorno

Van en `.env.local` (no se versiona). La plantilla es `.env.example`: copiala a `.env.local` y completala.

| Variable | Obligatoria | Uso |
|---|---|---|
| `DATABASE_URL` | sí | Connection string de Postgres/Supabase (`lib/db.js`). Usá el *Session pooler* y SSL: ver `docs/MIGRACION_POSTGRES.md`. |
| `DB_TIMEZONE`, `DB_POOL_MAX` | no | Zona horaria de la sesión (por defecto `America/Bogota`) y tamaño del pool (por defecto 5). |
| `SESSION_SECRET` | para tener sesión | Firma de la cookie de sesión, 32 caracteres como mínimo. Sin ella, el login no emite cookie. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | para el admin | Credenciales del login de admin (`/admin`). Si falta alguna, el login de admin queda deshabilitado. Reemplazan al admin hardcodeado (S5). |
| `AUTH_ENFORCED` | no | `true` exige sesión y rol en la API. Apagado por defecto: ver `docs/ROLLOUT_AUTH.md` antes de prenderlo. |
| `CATALOG_CACHE_SECONDS` | no | Segundos de caché HTTP de menús, marcas y municipios. Apagado por defecto. |

## Comandos

```bash
npm ci
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run test:coverage
```

`test:coverage` corre la misma suite y reporta la cobertura de `app/`, `lib/`, `components/` y `proxy.js` (el detalle queda en `coverage/`, que no se versiona).

```bash
npm run build
```

```bash
npm run lint
```

`npm run lint` todavía falla en la línea base (5 errores y 3 warnings conocidos, ver `docs/BACKLOG.md`): lo que importa es no sumar errores nuevos.

## Documentación

- `CLAUDE.md`: reglas de trabajo del proyecto.
- `docs/ARCHITECTURE.md`: estructura, API, sesión y autorización.
- `docs/BACKLOG.md`: deuda técnica priorizada.
- `docs/BUGS.md`: bugs conocidos.
- `docs/CHANGELOG.md`: historial de cambios.
- `docs/ROLLOUT_AUTH.md`: cómo prender la autenticación en producción.
