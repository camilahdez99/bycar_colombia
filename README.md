# Bycar

Plataforma de carpooling intermunicipal en Colombia: los conductores publican viajes, los pasajeros los buscan y solicitan cupo, se coordinan por chat y pueden activar un "guardián de ruta" que alerta a un contacto de confianza.

## Stack

Next.js 16 (App Router, JavaScript) · React 19 · Tailwind 4 · Oracle con `oracledb` · Vitest + Testing Library.

## Requisitos

- Node.js 24 (es la versión con la que se prueba el proyecto).
- Acceso a una base Oracle con el esquema de `scripts/tablas_DDL.txt`.

## Variables de entorno

Van en `.env.local` (no se versiona).

| Variable | Obligatoria | Uso |
|---|---|---|
| `DB_USER`, `DB_PASSWORD`, `DB_CONNECTION_STRING` | sí | Conexión a Oracle (`lib/db.js`). |
| `SESSION_SECRET` | para tener sesión | Firma de la cookie de sesión, 32 caracteres como mínimo. Sin ella, el login no emite cookie. |
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
