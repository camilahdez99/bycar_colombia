import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

// SELECT - Obtener todos los usuarios
export async function GET(req) {
  let connection;
  try {
    connection = await getConnection();
    const sql = `
      SELECT ID_USU as "id", NOMBRE_USU as "nombre", APELLIDO_USU as "apellido", CORREO_USU as "correo"
      FROM USUARIOS
      ORDER BY NOMBRE_USU ASC
    `;
    const result = await connection.execute(sql);
    return NextResponse.json(result.rows || [], { status: 200 });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}

// INSERT - Crear nuevo usuario
export async function POST(req) {
  let connection;
  try {
    const { nombre, apellido, correo, contrasena } = await req.json();

    if (!nombre || !apellido || !correo || !contrasena) {
      return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 });
    }

    connection = await getConnection();

    // Obtener el siguiente ID disponible
    const seqResult = await connection.execute(`SELECT NVL(MAX(ID_USU), 0) + 1 as "nextId" FROM USUARIOS`);
    const nextId = seqResult.rows[0].nextId;

    const sql = `
      INSERT INTO USUARIOS (ID_USU, NOMBRE_USU, APELLIDO_USU, CORREO_USU, CONTRASENA_USU, PERFIL_ID_PER)
      VALUES (:id, :nombre, :apellido, :correo, :contrasena, 2)
    `;
    // Perfil 2 = Usuario Estandar
    await connection.execute(
      sql,
      { id: nextId, nombre: nombre.toUpperCase(), apellido: apellido.toUpperCase(), correo, contrasena },
      { autoCommit: true }
    );

    return NextResponse.json({ message: 'Usuario creado exitosamente', id: nextId }, { status: 201 });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    if (error.message && error.message.includes('UN_CORREO_USU')) {
      return NextResponse.json({ error: 'El correo ya está registrado' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Error al crear usuario: ' + error.message }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}

// UPDATE - Actualizar usuario
export async function PUT(req) {
  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const { nombre, apellido, correo } = await req.json();

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    if (!nombre || !apellido || !correo) {
      return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 });
    }

    connection = await getConnection();
    const sql = `
      UPDATE USUARIOS 
      SET NOMBRE_USU = :nombre, APELLIDO_USU = :apellido, CORREO_USU = :correo 
      WHERE ID_USU = :id
    `;
    await connection.execute(
      sql,
      { id, nombre: nombre.toUpperCase(), apellido: apellido.toUpperCase(), correo },
      { autoCommit: true }
    );

    return NextResponse.json({ message: 'Usuario actualizado exitosamente' }, { status: 200 });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}

// DELETE - Eliminar usuario y sus dependencias
export async function DELETE(req) {
  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    connection = await getConnection();

    // Eliminar usuario. ON DELETE CASCADE en la BD eliminará el resto.
    await connection.execute(`DELETE FROM USUARIOS WHERE ID_USU = :id`, { id }, { autoCommit: true });

    return NextResponse.json({ message: 'Usuario eliminado correctamente' }, { status: 200 });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    return NextResponse.json({ error: 'Error al eliminar usuario: ' + error.message }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}
