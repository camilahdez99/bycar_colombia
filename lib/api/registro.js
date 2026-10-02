import { PERFIL } from '@/lib/domain/constantes';
import { VERIFICACION } from '@/lib/domain/verificacionRegistro';

/**
 * Inserta el usuario y un permiso por cada menú, sin confirmar: quien llama hace commit o
 * rollback. Es el mismo SQL que usaba POST /api/auth/register; ahora también lo usa la
 * verificación del correo. Devuelve el ID del usuario nuevo.
 */
export async function crearUsuario(connection, { nombre, apellido, correo, contrasena }) {
  // Generar un ID único simple para el usuario (en un entorno real se usaría una secuencia o IDENTITY)
  const idUsu = Date.now();

  const sql = `
      INSERT INTO USUARIOS (ID_USU, NOMBRE_USU, APELLIDO_USU, CORREO_USU, CONTRASENA_USU, PERFIL_ID_PER)
      VALUES (:idUsu, :nombre, :apellido, :correo, :contrasena, :perfilId)
    `;

  const binds = {
    idUsu,
    nombre: String(nombre).toUpperCase(),
    apellido: String(apellido).toUpperCase(),
    correo: String(correo).trim().toLowerCase(),
    contrasena,
    perfilId: PERFIL.USUARIO_ESTANDAR
  };

  await connection.execute(sql, binds, { autoCommit: false });

  // Asignar todos los permisos (menús) por defecto al nuevo usuario
  const menusRes = await connection.execute(`SELECT ID_ENU FROM MENUS`);
  if (menusRes.rows && menusRes.rows.length > 0) {
    for (const m of menusRes.rows) {
      await connection.execute(
        `INSERT INTO PERMISOS (USUARIO_ID_USU, MENU_ID_ENU) VALUES (:idUsu, :menuId)`,
        { idUsu, menuId: m.ID_ENU },
        { autoCommit: false }
      );
    }
  }

  return idUsu;
}

// ---------------------------------------------------------------------------
// REGISTROS_PENDIENTES: registros que esperan el código del correo (EMAIL_VERIFICATION)
// Los tiempos se calculan en la BD, para no depender del reloj del servidor de la app.
// ---------------------------------------------------------------------------

export const MENSAJE_ENVIO_FALLIDO = 'No pudimos enviar el código a ese correo. Revisa que esté bien escrito e intenta de nuevo.';

const VENCE_EN = `CURRENT_TIMESTAMP + INTERVAL '${VERIFICACION.VIGENCIA_SEG} seconds'`;
const SIN_CONFIRMAR = { autoCommit: false };

/** Borra los pendientes vencidos de cualquier correo: así no quedan datos de registros abandonados. */
export function limpiarPendientesVencidos(connection) {
  return connection.execute(
    `DELETE FROM REGISTROS_PENDIENTES WHERE EXPIRA_REG <= CURRENT_TIMESTAMP`, {}, SIN_CONFIRMAR,
  );
}

/** true si ya hay un usuario con ese correo (sin distinguir mayúsculas). */
export async function correoYaRegistrado(connection, correo) {
  const result = await connection.execute(
    `SELECT COUNT(*) AS "total" FROM USUARIOS WHERE LOWER(CORREO_USU) = :correo`, { correo },
  );
  return Number(result.rows?.[0]?.total ?? 0) > 0;
}

/** El registro pendiente del correo, con `vencido` (0/1) y los segundos desde el último envío; o null. */
export async function buscarPendiente(connection, correo) {
  const result = await connection.execute(`
      SELECT ID_REG AS "id",
             NOMBRE_REG AS "nombre",
             APELLIDO_REG AS "apellido",
             CORREO_REG AS "correo",
             CONTRASENA_REG AS "contrasena",
             CODIGO_HASH_REG AS "codigoHash",
             INTENTOS_REG AS "intentos",
             REENVIOS_REG AS "reenvios",
             CASE WHEN EXPIRA_REG <= CURRENT_TIMESTAMP THEN 1 ELSE 0 END AS "vencido",
             EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ULTIMO_ENVIO_REG)) AS "segundosDesdeEnvio"
      FROM REGISTROS_PENDIENTES
      WHERE CORREO_REG = :correo
    `, { correo });
  return result.rows?.[0] ?? null;
}

/** Crea el registro pendiente con el hash del código; vence en 5 minutos. */
export function crearPendiente(connection, { nombre, apellido, correo, contrasena, codigoHash }) {
  return connection.execute(`
      INSERT INTO REGISTROS_PENDIENTES (ID_REG, NOMBRE_REG, APELLIDO_REG, CORREO_REG, CONTRASENA_REG, CODIGO_HASH_REG, EXPIRA_REG)
      VALUES (:id, :nombre, :apellido, :correo, :contrasena, :codigoHash, ${VENCE_EN})
    `, { id: Date.now(), nombre, apellido, correo, contrasena, codigoHash }, SIN_CONFIRMAR);
}

/** Descarta el registro pendiente del correo. */
export function borrarPendiente(connection, correo) {
  return connection.execute(
    `DELETE FROM REGISTROS_PENDIENTES WHERE CORREO_REG = :correo`, { correo }, SIN_CONFIRMAR,
  );
}

/**
 * Suma un intento fallido solo si nadie lo cambió desde que se leyó. Devuelve false si otro
 * intento llegó antes (dos envíos a la vez no pueden regalar un intento extra).
 */
export async function sumarIntentoFallido(connection, id, intentosPrevios) {
  const result = await connection.execute(`
      UPDATE REGISTROS_PENDIENTES SET INTENTOS_REG = INTENTOS_REG + 1
      WHERE ID_REG = :id AND INTENTOS_REG = :intentosPrevios
    `, { id, intentosPrevios: Number(intentosPrevios) }, SIN_CONFIRMAR);
  return result.rowsAffected === 1;
}

/** Código nuevo: reinicia los 5 minutos y los intentos, y cuenta un reenvío. */
export function renovarCodigo(connection, id, codigoHash) {
  return connection.execute(`
      UPDATE REGISTROS_PENDIENTES
      SET CODIGO_HASH_REG = :codigoHash,
          INTENTOS_REG = 0,
          REENVIOS_REG = REENVIOS_REG + 1,
          EXPIRA_REG = ${VENCE_EN},
          ULTIMO_ENVIO_REG = CURRENT_TIMESTAMP
      WHERE ID_REG = :id
    `, { id, codigoHash }, SIN_CONFIRMAR);
}
