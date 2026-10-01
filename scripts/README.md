# scripts/

Scripts de la base de datos y utilidades sueltas. Nada de esto corre en la aplicación.

## PostgreSQL (Supabase) — vigentes

Se corren en orden. Paso a paso en `docs/MIGRACION_POSTGRES.md`.

| Archivo | Qué es |
|---|---|
| `postgres/01_esquema.sql` | Esquema normalizado (3FN): tablas, restricciones y RLS. Empieza borrando las tablas. **Fuente de verdad de los nombres de columnas.** |
| `postgres/02_indices.sql` | Creación de índices, con la justificación de cada uno. |
| `postgres/03_datos_iniciales.sql` | Datos iniciales: roles, perfiles, estados, marcas, menús, departamentos y municipios. |
| `postgres/04_usuario_admin.sql` | Opcional: el usuario admin del seed original. ⚠️ Cambiar la contraseña antes de correrlo (BUGS S5). |

## Oracle — históricos

Los scripts originales, de los que salieron los de `postgres/`. Ya no se usan.

| Archivo | Qué es | Estado |
|---|---|---|
| `tablas_DDL.txt` | DDL del esquema en Oracle: tablespaces, tablas y restricciones. | Histórico. |
| `indices_DML.txt` | Índices en Oracle. | Histórico. |
| `insercion_data_DML.txt` | Datos iniciales en Oracle. | Histórico. ⚠️ Incluye la credencial del admin hardcodeado (BUGS S5). |
| `diagrama.txt` | Script de SQL*Plus que prepara la base y el usuario de la aplicación. | Histórico. ⚠️ Contiene credenciales en texto plano (BUGS S9). No usarlo tal cual. |

## Utilidades

| Archivo | Qué es | Estado |
|---|---|---|
| `verificar-consultas-auth.mjs` | Verificador de solo lectura de las consultas de pertenencia, antes de prender `AUTH_ENFORCED`. Uso en su encabezado y en `docs/ROLLOUT_AUTH.md`. Necesita `DATABASE_URL`. | Vigente. |
| `fix_guardian.js` | Script local de mantenimiento. | Excluido de git (`.git/info/exclude`) porque tiene credenciales (BUGS S7). Puede no existir en otros clones. Sigue usando Oracle. |

Reglas (ver `CLAUDE.md`): fuera de la migración, la base está fuera de alcance; estos archivos no se ejecutan desde el proyecto.
