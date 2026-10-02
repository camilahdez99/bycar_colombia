# Migración de Oracle a PostgreSQL (Supabase)

Rama `feat/migracion-postgres` (2026-10-01). La aplicación pasó de `oracledb` a `pg` sin cambiar el contrato de la API: las rutas devuelven los mismos datos con las mismas claves.

## 1. Crear la base en Supabase

1. Creá el proyecto en Supabase y abrí **SQL Editor**.
2. Recomendado: fijá la zona horaria de la base, para que también la usen las conexiones que no pasen por `lib/db.js`:
   ```sql
   ALTER DATABASE postgres SET timezone TO 'America/Bogota';
   ```
3. Corré los scripts de `scripts/postgres/` en orden, cada uno completo:

   | Archivo | Qué hace |
   |---|---|
   | `01_esquema.sql` | Borra y crea las 16 tablas (mismas columnas, constraints y `ON DELETE CASCADE` que Oracle) y activa RLS. ⚠️ Sobre una base con datos los elimina. |
   | `02_indices.sql` | Los 18 índices de `indices_DML.txt`. |
   | `03_datos_iniciales.sql` | Roles, perfiles, 33 departamentos, 1 120 municipios, 20 marcas, estados y menús, con los mismos IDs. |
   | `04_usuario_admin.sql` | Opcional. El usuario admin del seed original. **Antes de correrlo, cambiá la contraseña `'admin'`** (BUGS S5). |
   | `05_guardian_y_chats.sql` | Solo para una base creada **antes** del 2026-10-01 con la versión anterior de 01 y 02: agrega `GUARDIANES.USUARIO_ID_USU` / `CONTACTO_ID_USU` y `MENSAJES.SOLICITUD_ID_SOL` / `GUARDIAN_ID_GUA` con sus FK e índices. Idempotente y sin borrar datos. Una base nueva ya las tiene por 01 y 02. Hay que correrlo **antes** de desplegar el código que las usa. |
   | `06_registros_pendientes.sql` | Solo para una base creada **antes** del 2026-10-02: crea `REGISTROS_PENDIENTES` (registros que esperan el código del correo) con su índice y RLS. Idempotente. Hay que correrlo **antes** de encender `EMAIL_VERIFICATION`. |

   También se pueden correr con `psql "$DATABASE_URL" -f scripts/postgres/01_esquema.sql` (y así con los demás).

## 2. Conectar la aplicación

En `.env.local` (y en las variables del entorno donde se despliegue), reemplazá `DB_USER`, `DB_PASSWORD` y `DB_CONNECTION_STRING` por:

| Variable | Obligatoria | Valor |
|---|---|---|
| `DATABASE_URL` | sí | Connection string de Supabase: **Connect → Session pooler** (puerto 5432). |
| `DB_TIMEZONE` | no | Zona horaria de la sesión. Por defecto `America/Bogota`. |
| `DB_POOL_MAX` | no | Conexiones del pool por proceso. Por defecto 5. |

**SSL.** Supabase exige SSL. Lo más seguro es verificar el certificado: descargá el CA desde **Database Settings → SSL Configuration** y agregá `?sslmode=verify-full&sslrootcert=/ruta/al/prod-ca-2021.crt` a la URL. `sslmode=require` puede fallar con `self-signed certificate in certificate chain` porque `pg` lo trata como `verify-full`.

**Session pooler o transaction pooler.** Con el *transaction pooler* (puerto 6543) el `SET TimeZone` que hace `lib/db.js` al abrir cada conexión no se conserva entre transacciones. Si lo usás (por ejemplo en serverless), el paso 1.2 (`ALTER DATABASE … SET timezone`) es obligatorio.

**Verificar.** Con la base cargada:
```bash
node --env-file=.env.local scripts/verificar-consultas-auth.mjs --usuario 1
```

## 3. Datos de producción

> **Decisión (2026-10-01): no se migran los datos de Oracle.** Es un proyecto académico y la base de Supabase arranca de cero (catálogos del seed + datos nuevos cargados desde la app). Esta sección queda como referencia por si alguna vez hace falta.

Los scripts crean el esquema y los catálogos, no copian los datos que hoy están en Oracle (usuarios, vehículos, viajes, solicitudes, mensajes, guardianes, permisos). Para llevarlos:

1. Exportá cada tabla desde Oracle (SQL Developer → *Export* como CSV, o `INSERT`s).
2. Importalas en Supabase después de `03_datos_iniciales.sql`, respetando el orden de las FK: `USUARIOS` → `PERMISOS` → `VEHICULOS` → `VIAJES` → `SOLICITUDES`, `MENSAJES`, `GUARDIANES`. También van las filas de `MARCAS` y `MUNICIPIOS` que la app haya creado por encima de las del seed (IDs nuevos).
3. Las columnas `DATE` de Oracle pasan a `TIMESTAMP` sin zona (hora de Colombia, igual que antes). `FECHA_ENVIO_MEN` y `FECHA_INICIO_GUA` son `TIMESTAMPTZ`: exportalas con zona, o en hora de Colombia con la sesión en `America/Bogota`.
4. Si exportás `INSERT`s, revisá que no traigan `TO_DATE(...)` con formatos que Postgres no entienda, ni el esquema `US_BYCAR.` delante del nombre de la tabla.

## Qué cambió en el código

- `lib/db.js`: pool de `pg` (uno por proceso), zona horaria de sesión y parsers para que `NUMERIC` y `BIGINT` lleguen como número.
- `lib/pg/`: adaptador con el contrato de oracledb. Convierte binds `:nombre` a `$n`, devuelve columnas sin alias en MAYÚSCULAS, trata `''` como `NULL` (como Oracle), usa un savepoint por sentencia dentro de transacciones (en Oracle un error solo deshace la sentencia) y agrega `errorNum` con el código de Oracle equivalente al SQLSTATE.
- Rutas: `ROWNUM = 1` → `LIMIT 1`, `SYSDATE`/`SYSTIMESTAMP`/`TRUNC(SYSDATE)` → `LOCALTIMESTAMP(0)`/`CURRENT_TIMESTAMP`/`CURRENT_DATE`, `NVL` → `COALESCE`, `TO_CHAR(clob)` → la columna, y el diccionario de Oracle (`user_tables`…) → `information_schema` con la misma forma de respuesta.

## Diferencias conocidas con Oracle

- **Orden de textos.** `ORDER BY` de marcas y municipios usa la collation de la base (ver `SHOW lc_collate;`), que puede ordenar mayúsculas, minúsculas y acentos distinto del `NLS_SORT` de Oracle.
- **Largo de `VARCHAR`.** En Oracle era en bytes (`VARCHAR2(n BYTE)`) y en Postgres es en caracteres: un texto con tildes que antes no entraba ahora puede entrar.
- **Usuario de conexión.** La app se conecta con el usuario `postgres` de Supabase, dueño de las tablas (RLS no lo afecta). Un rol propio con permisos mínimos queda anotado como BD-22.
