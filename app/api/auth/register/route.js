import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function POST(req) {
  let connection;
  try {
    const { nombre, apellido, correo, contrasena } = await req.json();

    if (!nombre || !apellido || !correo || !contrasena) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    connection = await getConnection();

    // Generar un ID único simple para el usuario (en un entorno real se usaría secuencias de Oracle)
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
      perfilId: 2 // 2 = Usuario Estándar (según script seed_3fn)
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

    // Confirmar la transacción
    await connection.commit();

    return NextResponse.json({ message: 'Usuario registrado correctamente', id: idUsu }, { status: 201 });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Error en rollback:', rollbackError);
      }
    }
    // Detect duplicate email (unique‑constraint violation)
    if (error && error.errorNum === 1) {
      // ORA‑00001: unique constraint (email) violated
      return NextResponse.json({ error: 'El correo ya está registrado' }, { status: 409 });
    }
    // Detect foreign‑key violation (e.g., perfil no existe)
    if (error && error.errorNum === 2291) {
      // ORA‑02291: integrity constraint (FK) violated
      return NextResponse.json({ error: 'Perfil no válido o datos faltantes' }, { status: 400 });
    }
    console.error('Error al registrar usuario:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
}
