// scripts/create_admin_user.js
import { getConnection } from '@/lib/db';
import oracledb from 'oracledb';

/**
 * Crea un usuario administrador con los datos proporcionados.
 * Uso: `node scripts/create_admin_user.js`
 */
(async () => {
  const nombre = 'Camila';
  const apellido = 'Hernandez';
  const correo = 'admin@bycar.com';
  const contrasena = 'admin'; // Nota: en producción debería almacenarse como hash
  const perfilNombre = 'ADMIN';

  let connection;
  try {
    connection = await getConnection();
    // Obtener id del perfil ADMIN
    const perfilRes = await connection.execute(
      `SELECT ID_PER FROM PERFILES WHERE NOMBRE_PER = :nombre`,
      { nombre: perfilNombre },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!perfilRes.rows.length) {
      console.error('Perfil ADMIN no encontrado en la tabla PERFILES');
      process.exit(1);
    }
    const perfilId = perfilRes.rows[0].ID_PER;
    // Insertar usuario
    const sql = `INSERT INTO USUARIOS (ID_USU, NOMBRE, APELLIDO, CORREO, CONTRASENA, PERFIL_ID_PER)
                 VALUES (1, :nombre, :apellido, :correo, :contrasena, :perfilId)`;
    await connection.execute(sql, { nombre, apellido, correo, contrasena, perfilId }, { autoCommit: true });
    console.log('Usuario admin creado exitosamente');
  } catch (err) {
    console.error('Error creando usuario admin:', err);
  } finally {
    if (connection) await connection.close();
  }
})();
