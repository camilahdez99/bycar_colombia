import { NextResponse } from 'next/server';
import oracledb from 'oracledb';
import { getConnection } from '@/lib/db';
import { logError } from '@/lib/log';
import { closeConnection } from '@/lib/api/connection';
import { authorize, forbidden, getSession, isAuthEnforced, unauthenticated } from '@/lib/auth/guard';
import { ROLES } from '@/lib/auth/session';

// El dashboard consulta los permisos del propio usuario; cualquier otra lectura requiere admin
async function authorizeRead(req) {
  if (!isAuthEnforced()) return null;
  const session = await getSession(req);
  if (!session) return unauthenticated();
  if (session.role === ROLES.ADMIN) return null;
  const usuarioId = new URL(req.url).searchParams.get('usuarioId');
  const esPropio = usuarioId !== null && String(session.userId) === usuarioId;
  return esPropio ? null : forbidden();
}

// GET — obtener permisos de un perfil (menús asignados)
export async function GET(req) {
  const denied = await authorizeRead(req);
  if (denied) return denied;

  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const usuarioId = searchParams.get('usuarioId');

    connection = await getConnection();

    if (usuarioId) {
      // Menús asignados a un usuario específico
      const sql = `
        SELECT p.USUARIO_ID_USU as "usuarioId", p.MENU_ID_ENU as "menuId",
               m.CAMPO_ENU as "menuNombre", m.URL_ENU as "menuUrl"
        FROM PERMISOS p
        JOIN MENUS m ON p.MENU_ID_ENU = m.ID_ENU
        WHERE p.USUARIO_ID_USU = :usuarioId
        ORDER BY m.ID_ENU
      `;
      const result = await connection.execute(sql, { usuarioId: Number(usuarioId) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return NextResponse.json(result.rows || [], { status: 200 });
    }

    // Todos los permisos
    const sql = `
      SELECT p.USUARIO_ID_USU as "usuarioId", u.NOMBRE_USU as "usuarioNombre",
             p.MENU_ID_ENU as "menuId", m.CAMPO_ENU as "menuNombre", m.URL_ENU as "menuUrl"
      FROM PERMISOS p
      JOIN USUARIOS u ON p.USUARIO_ID_USU = u.ID_USU
      JOIN MENUS m ON p.MENU_ID_ENU = m.ID_ENU
      ORDER BY p.USUARIO_ID_USU, m.ID_ENU
    `;
    const result = await connection.execute(sql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return NextResponse.json(result.rows || [], { status: 200 });
  } catch (error) {
    logError('api_error', error, { route: 'GET /api/admin/permisos' });
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    await closeConnection(connection, 'GET /api/admin/permisos');
  }
}

// POST — asignar un menú a un usuario
export async function POST(req) {
  const denied = await authorize(req, { role: ROLES.ADMIN });
  if (denied) return denied;

  let connection;
  try {
    const { usuarioId, menuId } = await req.json();
    if (!usuarioId || !menuId) {
      return NextResponse.json({ error: 'usuarioId y menuId son requeridos' }, { status: 400 });
    }

    connection = await getConnection();
    const sql = `INSERT INTO PERMISOS (USUARIO_ID_USU, MENU_ID_ENU) VALUES (:usuarioId, :menuId)`;
    await connection.execute(sql, { usuarioId: Number(usuarioId), menuId: Number(menuId) }, { autoCommit: true });
    return NextResponse.json({ message: 'Permiso asignado' }, { status: 201 });
  } catch (error) {
    if (error.message?.includes('ORA-00001')) {
      return NextResponse.json({ error: 'Este permiso ya existe' }, { status: 409 });
    }
    logError('api_error', error, { route: 'POST /api/admin/permisos' });
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    await closeConnection(connection, 'POST /api/admin/permisos');
  }
}

// DELETE — revocar un menú de un usuario
export async function DELETE(req) {
  const denied = await authorize(req, { role: ROLES.ADMIN });
  if (denied) return denied;

  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const usuarioId = searchParams.get('usuarioId');
    const menuId = searchParams.get('menuId');

    if (!usuarioId || !menuId) {
      return NextResponse.json({ error: 'usuarioId y menuId son requeridos' }, { status: 400 });
    }

    connection = await getConnection();
    const sql = `DELETE FROM PERMISOS WHERE USUARIO_ID_USU = :usuarioId AND MENU_ID_ENU = :menuId`;
    await connection.execute(sql, { usuarioId: Number(usuarioId), menuId: Number(menuId) }, { autoCommit: true });
    return NextResponse.json({ message: 'Permiso revocado' }, { status: 200 });
  } catch (error) {
    logError('api_error', error, { route: 'DELETE /api/admin/permisos' });
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    await closeConnection(connection, 'DELETE /api/admin/permisos');
  }
}
