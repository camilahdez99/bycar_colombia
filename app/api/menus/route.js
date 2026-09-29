import { NextResponse } from 'next/server';
import oracledb from 'oracledb';
import { getConnection } from '@/lib/db';

// GET - Obtener todos los ítems del menú desde la tabla MENUS
export async function GET() {
  let connection;
  try {
    connection = await getConnection();
    const sql = `
      SELECT 
        ID_ENU      as "id",
        CAMPO_ENU   as "label",
        URL_ENU     as "url",
        MENU_ID_ENU as "parentId"
      FROM MENUS
      ORDER BY ID_ENU ASC
    `;
    const result = await connection.execute(sql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return NextResponse.json(result.rows || [], { status: 200 });
  } catch (error) {
    console.error('Error al obtener menús:', error);
    return NextResponse.json({ error: 'Error al obtener menús' }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (_) {}
    }
  }
}
