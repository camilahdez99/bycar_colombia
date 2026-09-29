import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

// SELECT - Obtener todos los conductores (usuarios que tienen vehículos registrados)
// En el esquema 3FN no existe tabla CONDUCTOR; un conductor es un usuario con vehículos.
export async function GET(req) {
  let connection;
  try {
    connection = await getConnection();
    const sql = `
      SELECT DISTINCT
             u.ID_USU as "id",
             u.ID_USU as "idUsuario",
             u.NOMBRE_USU as "nombre", 
             u.APELLIDO_USU as "apellido", 
             u.CORREO_USU as "correo",
             (SELECT COUNT(*) FROM VEHICULOS v WHERE v.CONDUCTOR_ID_USU = u.ID_USU) as "totalVehiculos",
             (SELECT COUNT(*) FROM VIAJES vi WHERE vi.USUARIOS_ID_USU = u.ID_USU) as "totalViajes"
      FROM USUARIOS u
      WHERE EXISTS (SELECT 1 FROM VEHICULOS v WHERE v.CONDUCTOR_ID_USU = u.ID_USU)
         OR EXISTS (SELECT 1 FROM VIAJES vi WHERE vi.USUARIOS_ID_USU = u.ID_USU)
      ORDER BY u.NOMBRE_USU ASC
    `;
    const result = await connection.execute(sql);
    return NextResponse.json(result.rows || [], { status: 200 });
  } catch (error) {
    console.error('Error al obtener conductores:', error);
    return NextResponse.json({ error: 'Error al obtener conductores' }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}

// En el nuevo esquema 3FN, no se necesita crear un "conductor" separado.
// Un usuario se convierte en conductor al registrar un vehículo o publicar un viaje.
export async function POST(req) {
  return NextResponse.json({ 
    message: 'En el esquema actual, un usuario se convierte en conductor al registrar un vehículo o publicar un viaje.' 
  }, { status: 200 });
}

// DELETE - Eliminar los vehículos y viajes de un conductor (usuario)
export async function DELETE(req) {
  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    connection = await getConnection();

    // Eliminar vehículos del usuario (CASCADE eliminará viajes asociados)
    await connection.execute(`DELETE FROM VEHICULOS WHERE CONDUCTOR_ID_USU = :id`, { id });
    // Eliminar viajes del usuario
    await connection.execute(`DELETE FROM VIAJES WHERE USUARIOS_ID_USU = :id`, { id }, { autoCommit: true });

    return NextResponse.json({ message: 'Datos de conductor eliminados correctamente' }, { status: 200 });
  } catch (error) {
    console.error('Error al eliminar conductor:', error);
    return NextResponse.json({ error: 'Error al eliminar conductor: ' + error.message }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}
