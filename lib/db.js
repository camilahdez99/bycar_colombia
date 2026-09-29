import oracledb from 'oracledb';

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
    console.error("Error crítico de conexión a Oracle DB:", err.message);
    throw err;
  }
}
