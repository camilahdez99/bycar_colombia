import oracledb from 'oracledb';
// Ruta relativa con extensión: scripts/verificar-consultas-auth.mjs importa este módulo con Node sin alias
import { logError } from './log.js';

// Configuración opcional para que retorne objetos JSON en lugar de arrays
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;
oracledb.fetchAsString = [ oracledb.CLOB ];

/**
 * Función para obtener una conexión a Oracle DB.
 * Se debe usar en los endpoints API para realizar consultas.
 */
export async function getConnection() {
  const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECTION_STRING
  };

  try {
    const connection = await oracledb.getConnection(dbConfig);
    return connection;
  } catch (err) {
    logError('db_connect_failed', err);
    throw err;
  }
}
