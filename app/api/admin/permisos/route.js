import { NextResponse } from 'next/server';
import oracledb from 'oracledb';
import { getConnection } from '@/lib/db';

// GET — obtener permisos de un perfil (menús asignados)
export async function GET(req) {
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
    console.error('Error en GET /api/admin/permisos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (connection) try { await connection.close(); } catch {}
  }
}

// POST — asignar un menú a un usuario
export async function POST(req) {
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
    console.error('Error en POST /api/admin/permisos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (connection) try { await connection.close(); } catch {}
  }
}

// DELETE — revocar un menú de un usuario
export async function DELETE(req) {
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
    console.error('Error en DELETE /api/admin/permisos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (connection) try { await connection.close(); } catch {}
  }
}
