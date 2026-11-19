import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { closeConnection } from '@/lib/api/connection';
import { logError } from '@/lib/log';
import { authorize } from '@/lib/auth/guard';
import { requireSelf } from '@/lib/auth/ownership';
import { badRequest } from '@/lib/api/validacion';
import { enteroPositivo } from '@/lib/domain/validadores';

/**
 * Último contacto de confianza que el usuario usó como guardián, para precargarlo la próxima vez
 * (puede elegir otro). Devuelve { id, nombre, correo } o null si nunca activó un guardián.
 */
export async function GET(req) {
  const denied = await authorize(req);
  if (denied) return denied;

  let connection;
  try {
    const usuarioId = new URL(req.url).searchParams.get('usuarioId');
    if (!usuarioId) return badRequest('Falta usuarioId');
    if (!enteroPositivo(usuarioId)) return badRequest('usuarioId inválido');

    const notOwner = await requireSelf(req, usuarioId);
    if (notOwner) return notOwner;

    connection = await getConnection();

    const sql = `
      SELECT u.ID_USU as "id",
             u.NOMBRE_USU || ' ' || u.APELLIDO_USU as "nombre",
             u.CORREO_USU as "correo"
      FROM GUARDIANES g
      JOIN USUARIOS u ON g.CONTACTO_ID_USU = u.ID_USU
      WHERE g.USUARIO_ID_USU = :usuarioId AND g.CONTACTO_ID_USU IS NOT NULL
      ORDER BY g.ID_GUA DESC
      LIMIT 1
    `;
    const result = await connection.execute(sql, { usuarioId: Number(usuarioId) });
    return NextResponse.json(result.rows?.[0] ?? null, { status: 200 });
  } catch (error) {
    logError('api_error', error, { route: 'GET /api/guardian/ultimo-contacto', mensaje: 'Error al obtener el último contacto' });
    return NextResponse.json({ error: 'Error al obtener el último contacto' }, { status: 500 });
  } finally {
    await closeConnection(connection, 'GET /api/guardian/ultimo-contacto');
  }
}
