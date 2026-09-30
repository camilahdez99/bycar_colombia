import { NextResponse } from 'next/server';
import oracledb from 'oracledb';
import { getConnection } from '@/lib/db';
import { closeConnection } from '@/lib/api/connection';
import { logError } from '@/lib/log';

// GET - Obtener todas las marcas registradas
export async function GET(req) {
  let connection;
  try {
    connection = await getConnection();
    const sql = `
      SELECT ID_MAR as "id", NOMBRE_MAR as "nombre"
      FROM MARCAS
      ORDER BY NOMBRE_MAR ASC
    `;
    const result = await connection.execute(sql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return NextResponse.json(result.rows || [], { status: 200 });
  } catch (error) {
    logError('api_error', error, { route: 'GET /api/marcas', mensaje: 'Error al obtener marcas' });
    return NextResponse.json({ error: 'Error al obtener marcas' }, { status: 500 });
  } finally {
    await closeConnection(connection, 'GET /api/marcas');
  }
}
