import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import {
  ROLES,
  SESSION_COOKIE,
  encodeSession,
  isSessionConfigured,
  sessionCookieOptions,
} from '@/lib/auth/session';

// Emite la cookie de sesión solo si SESSION_SECRET está configurado; si no, el login responde como antes
async function withSession(response, session) {
  if (!isSessionConfigured()) {
    console.warn(JSON.stringify({ event: 'session_not_issued', reason: 'SESSION_SECRET no configurado' }));
    return response;
  }
  response.cookies.set(SESSION_COOKIE, await encodeSession(session), sessionCookieOptions());
  return response;
}

export async function POST(req) {
  let connection;
  try {
    const { correo, contrasena } = await req.json();

    if (!correo || !contrasena) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // Hardcodeado para propósitos de admin como pidió en el login original
    if (correo === 'admin@bycar.co' && contrasena === 'admin') {
      return withSession(
        NextResponse.json({ message: 'Login exitoso', redirect: '/admin' }, { status: 200 }),
        { userId: null, role: ROLES.ADMIN }
      );
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
      return withSession(
        NextResponse.json({ message: 'Login exitoso', user, redirect: '/dashboard' }, { status: 200 }),
        { userId: user.ID_USU, role: ROLES.USER }
      );
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
