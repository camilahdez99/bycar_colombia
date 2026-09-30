# scripts/

Material de referencia de la base de datos y utilidades sueltas. Nada de esto corre en la aplicación.

| Archivo | Qué es | Estado |
|---|---|---|
| `tablas_DDL.txt` | DDL del esquema normalizado (3FN): tablespaces, tablas y restricciones. Empieza borrando las tablas. | Referencia. Es la fuente de verdad de los nombres de columnas. |
| `indices_DML.txt` | Creación de índices, con la justificación de cada uno. | Referencia. |
| `insercion_data_DML.txt` | Datos iniciales: roles, perfiles, estados, menús, departamentos y municipios, y el usuario admin. | Referencia. ⚠️ Incluye la credencial del admin hardcodeado (BUGS S5). |
| `diagrama.txt` | Script de SQL*Plus que prepara la base y el usuario de la aplicación. | ⚠️ Contiene credenciales en texto plano (BUGS S9). No usarlo tal cual. |
| `verificar-consultas-auth.mjs` | Verificador de solo lectura de las consultas de pertenencia, antes de prender `AUTH_ENFORCED`. Uso en su encabezado y en `docs/ROLLOUT_AUTH.md`. | Vigente. |
| `fix_guardian.js` | Script local de mantenimiento. | Excluido de git (`.git/info/exclude`) porque tiene credenciales (BUGS S7). Puede no existir en otros clones. |

Reglas (ver `CLAUDE.md`): la base está fuera de alcance, así que estos archivos no se ejecutan desde el proyecto y no se modifica su SQL.
