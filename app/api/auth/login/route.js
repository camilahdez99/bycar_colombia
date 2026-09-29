import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function POST(req) {
  let connection;
  try {
    const { correo, contrasena } = await req.json();

    if (!correo || !contrasena) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // Hardcodeado para propósitos de admin como pidió en el login original
    if (correo === 'admin@bycar.co' && contrasena === 'admin') {
      return NextResponse.json({ message: 'Login exitoso', redirect: '/admin' }, { status: 200 });
    }

    connection = await getConnection();

    const sql = `
      SELECT ID_USU, NOMBRE_USU, APELLIDO_USU, CORREO_USU 
      FROM USUARIOS 
      WHERE LOWER(CORREO_USU) = LOWER(:correo) AND CONTRASENA_USU = :contrasena
    `;

    const result = await connection.execute(sql, { correo: String(correo).trim(), contrasena });

    if (result.rows && result.rows.length > 0) {
      const user = result.rows[0];
      return NextResponse.json({ message: 'Login exitoso', user, redirect: '/dashboard' }, { status: 200 });
    } else {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
    }
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
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
