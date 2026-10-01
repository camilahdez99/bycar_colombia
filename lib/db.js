import pg from 'pg';
// Rutas relativas con extensión: scripts/verificar-consultas-auth.mjs importa este módulo con Node sin alias
import { logError } from './log.js';
import { ConexionPg } from './pg/conexion.js';

// Hora de Colombia, como el servidor Oracle: SYSDATE/TO_CHAR de fechas y la cuenta regresiva del guardián dependen de ella
const ZONA_HORARIA_POR_DEFECTO = 'America/Bogota';
const MAX_CONEXIONES_POR_DEFECTO = 5;

// Oracle entrega NUMBER como número; pg entrega NUMERIC y BIGINT (y COUNT(*)) como texto
const tipos = {
  getTypeParser(oid, formato) {
    if (oid === pg.types.builtins.INT8 || oid === pg.types.builtins.NUMERIC) {
      return (valor) => (valor === null ? null : Number(valor));
    }
    return pg.types.getTypeParser(oid, formato);
  },
};

function maxConexiones() {
  const valor = Number(process.env.DB_POOL_MAX);
  return Number.isInteger(valor) && valor > 0 ? valor : MAX_CONEXIONES_POR_DEFECTO;
}

function crearPool() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: maxConexiones(),
    types: tipos,
  });
  const zonaHoraria = process.env.DB_TIMEZONE || ZONA_HORARIA_POR_DEFECTO;
  // pg encola las consultas por cliente: esta corre antes de la primera de la ruta
  pool.on('connect', (cliente) => {
    cliente.query(`SELECT set_config('TimeZone', $1, false)`, [zonaHoraria]).catch((error) => {
      logError('db_timezone_failed', error);
    });
  });
  // Un cliente inactivo que pierde la conexión emite 'error'; sin este handler tumbaría el proceso
  pool.on('error', (error) => logError('db_pool_error', error));
  return pool;
}

// Un solo pool por proceso; en desarrollo sobrevive al hot reload de Next
function obtenerPool() {
  globalThis.__bycarPgPool ??= crearPool();
  return globalThis.__bycarPgPool;
}

/**
 * Conexión a Postgres (Supabase) con la misma interfaz que tenía la de Oracle.
 * Se debe usar en los endpoints API y cerrar con closeConnection (lib/api/connection.js).
 * @param {{ autoCommit?: boolean }} [opciones] autoCommit por defecto de la conexión (true si se omite)
 */
export async function getConnection(opciones) {
  try {
    const cliente = await obtenerPool().connect();
    return new ConexionPg(cliente, opciones);
  } catch (err) {
    logError('db_connect_failed', err);
    throw err;
  }
}
