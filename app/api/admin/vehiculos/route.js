import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

// SELECT - Obtener todos los vehículos con datos del conductor
export async function GET(req) {
  let connection;
  try {
    connection = await getConnection();
    const sql = `
      SELECT veh.PLACA_VEH as "placa", 
             m.NOMBRE_MAR as "marca", 
             veh.CAPACIDAD_VEH as "capacidad",
             veh.CONDUCTOR_ID_USU as "idConductor",
             u.NOMBRE_USU || ' ' || u.APELLIDO_USU as "conductor"
      FROM VEHICULOS veh
      JOIN USUARIOS u ON veh.CONDUCTOR_ID_USU = u.ID_USU
      JOIN MARCAS m ON veh.MARCA_ID_MAR = m.ID_MAR
      ORDER BY m.NOMBRE_MAR ASC
    `;
    const result = await connection.execute(sql);
    return NextResponse.json(result.rows || [], { status: 200 });
  } catch (error) {
    console.error('Error al obtener vehículos:', error);
    return NextResponse.json({ error: 'Error al obtener vehículos' }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}

// INSERT - Registrar un nuevo vehículo
export async function POST(req) {
  let connection;
  try {
    const { placa, marcaId, capacidad, idConductor } = await req.json();

    if (!placa || !marcaId || !capacidad || !idConductor) {
      return NextResponse.json({ error: 'Todos los campos obligatorios deben ser proporcionados' }, { status: 400 });
    }

    if (placa.length > 6) {
      return NextResponse.json({ error: 'La placa no puede tener más de 6 caracteres' }, { status: 400 });
    }

    connection = await getConnection();

    // Verificar que el usuario/conductor existe
    const checkUser = await connection.execute(
      `SELECT ID_USU FROM USUARIOS WHERE ID_USU = :id`, { id: idConductor }
    );
    if (!checkUser.rows || checkUser.rows.length === 0) {
      return NextResponse.json({ error: 'El usuario/conductor no existe' }, { status: 404 });
    }

    const sql = `
      INSERT INTO VEHICULOS (PLACA_VEH, CAPACIDAD_VEH, CONDUCTOR_ID_USU, MARCA_ID_MAR)
      VALUES (:placa, :capacidad, :idConductor, :marcaId)
    `;
    await connection.execute(
      sql,
      { placa: placa.toUpperCase(), capacidad: parseInt(capacidad), idConductor, marcaId: parseInt(marcaId) },
      { autoCommit: true }
    );

    return NextResponse.json({ message: 'Vehículo registrado exitosamente', placa }, { status: 201 });
  } catch (error) {
    console.error('Error al crear vehículo:', error);
    if (error.message && error.message.includes('PK_VEHICULOS')) {
      return NextResponse.json({ error: 'Ya existe un vehículo con esa placa' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Error al crear vehículo: ' + error.message }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}

// UPDATE - Actualizar datos del vehículo
export async function PUT(req) {
  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const placa = searchParams.get('placa');
    const { marcaId, capacidad } = await req.json();

    if (!placa) return NextResponse.json({ error: 'Placa requerida' }, { status: 400 });
    if (!marcaId || !capacidad) {
      return NextResponse.json({ error: 'Marca y capacidad son obligatorios' }, { status: 400 });
    }

    connection = await getConnection();
    const sql = `
      UPDATE VEHICULOS 
      SET MARCA_ID_MAR = :marcaId, CAPACIDAD_VEH = :capacidad 
      WHERE PLACA_VEH = :placa
    `;
    await connection.execute(
      sql,
      { placa, marcaId: parseInt(marcaId), capacidad: parseInt(capacidad) },
      { autoCommit: true }
    );

    return NextResponse.json({ message: 'Vehículo actualizado exitosamente' }, { status: 200 });
  } catch (error) {
    console.error('Error al actualizar vehículo:', error);
    return NextResponse.json({ error: 'Error al actualizar vehículo' }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}

// DELETE - Eliminar vehículo
export async function DELETE(req) {
  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const placa = searchParams.get('placa');

    if (!placa) return NextResponse.json({ error: 'Placa requerida' }, { status: 400 });

    connection = await getConnection();

    // ON DELETE CASCADE se encarga de las dependencias
    await connection.execute(`DELETE FROM VEHICULOS WHERE PLACA_VEH = :placa`, { placa }, { autoCommit: true });

    return NextResponse.json({ message: 'Vehículo eliminado correctamente' }, { status: 200 });
  } catch (error) {
    console.error('Error al eliminar vehículo:', error);
    return NextResponse.json({ error: 'Error al eliminar vehículo: ' + error.message }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}
