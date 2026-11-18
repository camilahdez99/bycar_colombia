import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { closeConnection } from '@/lib/api/connection';
import { logError } from '@/lib/log';
import { authorize, getSession } from '@/lib/auth/guard';
import { badRequest } from '@/lib/api/validacion';
import { textoNoVacio } from '@/lib/domain/validadores';

// Mínimo de caracteres para buscar y máximo de resultados que se devuelven
const MIN_BUSQUEDA = 3;
const MAX_RESULTADOS = 10;

/**
 * Busca usuarios por nombre, apellido o correo, para el selector de contacto de confianza
 * del guardián. Devuelve solo id, nombre y correo (nunca la contraseña). Excluye al propio
 * usuario de la sesión. Cualquier usuario autenticado puede buscar: no hay recurso ajeno.
 */
export async function GET(req) {
  const denied = await authorize(req);
  if (denied) return denied;

  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const q = textoNoVacio(searchParams.get('q'));
    if (!q || q.length < MIN_BUSQUEDA) {
      return badRequest(`Escribe al menos ${MIN_BUSQUEDA} caracteres`);
    }

    // Con la sesión activa, no devolverse a uno mismo; sin auth (flag apagado), no hay sesión
    const propioId = (await getSession(req))?.userId ?? null;

    connection = await getConnection();

    const sql = `
      SELECT ID_USU as "id",
             NOMBRE_USU || ' ' || APELLIDO_USU as "nombre",
             CORREO_USU as "correo"
      FROM USUARIOS
      WHERE (UPPER(NOMBRE_USU || ' ' || APELLIDO_USU) LIKE UPPER(:patron)
             OR UPPER(CORREO_USU) LIKE UPPER(:patron))
        AND (:propioId::bigint IS NULL OR ID_USU != :propioId)
      ORDER BY NOMBRE_USU, APELLIDO_USU
      LIMIT ${MAX_RESULTADOS}
    `;
    const result = await connection.execute(sql, { patron: `%${q}%`, propioId });
    return NextResponse.json(result.rows || [], { status: 200 });
  } catch (error) {
    logError('api_error', error, { route: 'GET /api/usuarios/buscar', mensaje: 'Error al buscar usuarios' });
    return NextResponse.json({ error: 'Error al buscar usuarios' }, { status: 500 });
  } finally {
    await closeConnection(connection, 'GET /api/usuarios/buscar');
  }
}
