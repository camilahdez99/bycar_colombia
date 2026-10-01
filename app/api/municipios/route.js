import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { catalogCacheHeaders } from '@/lib/api/cache';
import { closeConnection } from '@/lib/api/connection';
import { logError } from '@/lib/log';

// GET - Obtener todos los municipios con su departamento
export async function GET() {
  let connection;
  try {
    connection = await getConnection();
    const sql = `
      SELECT m.ID_MUN as "id", m.NOMBRE_MUN as "nombre", d.NOMBRE_DEP as "departamento"
      FROM MUNICIPIOS m
      JOIN DEPARTAMENTOS d ON m.DEPARTAMENTO_ID_DEP = d.ID_DEP
      ORDER BY m.NOMBRE_MUN ASC
    `;
    const result = await connection.execute(sql, {});
    return NextResponse.json(result.rows || [], { status: 200, headers: catalogCacheHeaders() });
  } catch (error) {
    logError('api_error', error, { route: 'GET /api/municipios', mensaje: 'Error al obtener municipios' });
    return NextResponse.json({ error: 'Error al obtener municipios' }, { status: 500 });
  } finally {
    await closeConnection(connection, 'GET /api/municipios');
  }
}
