import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { closeConnection } from '@/lib/api/connection';
import { logError, logInfo } from '@/lib/log';
import { JSON_INVALIDO, badRequest, invalidJsonResponse, readJson } from '@/lib/api/validacion';
import { authorize } from '@/lib/auth/guard';
import { checkOwnership, requireSelf } from '@/lib/auth/ownership';
import { findSolicitudParticipants } from '@/lib/auth/ownershipQueries';
import { canChangeSolicitud, resolverEstadoSolicitud } from '@/lib/domain/solicitudes';
import { enteroPositivo } from '@/lib/domain/validadores';

export async function POST(req) {
  const denied = await authorize(req);
  if (denied) return denied;

  let connection;
  try {
    const body = await readJson(req);
    if (body === JSON_INVALIDO) return invalidJsonResponse();
    const { viajeId, usuarioId } = body ?? {};

    if (!viajeId || !usuarioId) {
      return NextResponse.json({ error: 'ID de viaje y usuario son requeridos' }, { status: 400 });
    }
    if (!enteroPositivo(viajeId) || !enteroPositivo(usuarioId)) {
      return badRequest('ID de viaje o usuario inválido');
    }

    const notOwner = await requireSelf(req, usuarioId);
    if (notOwner) return notOwner;

    connection = await getConnection();
    const idSol = Date.now();

    const sql = `
      INSERT INTO SOLICITUDES (ID_SOL, FECHA_SOL, ESTADO_ID_EST, VIAJES_ID_VIA, USUARIOS_ID_USU)
      VALUES (:idSol, LOCALTIMESTAMP(0), 1, :viajeId, :usuarioId)
    `;

    await connection.execute(sql, { idSol, viajeId, usuarioId }, { autoCommit: true });

    return NextResponse.json({ message: 'Solicitud enviada', id: idSol }, { status: 201 });
  } catch (error) {
    logError('api_error', error, { route: 'POST /api/solicitudes', mensaje: 'Error al solicitar viaje' });
    return NextResponse.json({ error: 'Error interno del servidor al crear solicitud' }, { status: 500 });
  } finally {
    await closeConnection(connection, 'POST /api/solicitudes');
  }
}

export async function PUT(req) {
  const denied = await authorize(req);
  if (denied) return denied;

  let connection;
  try {
    const body = await readJson(req);
    if (body === JSON_INVALIDO) return invalidJsonResponse();
    const { solicitudId, estado } = body ?? {};

    if (!solicitudId || !estado) {
      return NextResponse.json({ error: 'ID de solicitud y estado son requeridos' }, { status: 400 });
    }
    if (!enteroPositivo(solicitudId)) return badRequest('ID de solicitud inválido');

    // Se valida antes de abrir la conexión (BUGS E5); un estado fuera de catálogo también es inválido (F20)
    const estadoId = resolverEstadoSolicitud(estado);
    if (!estadoId) {
      return NextResponse.json({ error: `Estado desconocido: ${estado}` }, { status: 400 });
    }

    connection = await getConnection();

    const notAllowed = await checkOwnership(req, async (userId) =>
      canChangeSolicitud(userId, Number(estadoId), await findSolicitudParticipants(connection, solicitudId))
    );
    if (notAllowed) return notAllowed;

    const sql = `UPDATE SOLICITUDES SET ESTADO_ID_EST = :estadoId WHERE ID_SOL = :solicitudId`;
    const result = await connection.execute(
      sql,
      { estadoId: Number(estadoId), solicitudId: Number(solicitudId) },
      { autoCommit: true }
    );
    logInfo('solicitud_actualizada', { route: 'PUT /api/solicitudes', solicitudId, estadoId, rowsAffected: result.rowsAffected });

    // Sin filas afectadas la solicitud no existe (BUGS F19)
    if (result.rowsAffected === 0) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Solicitud actualizada' }, { status: 200 });
  } catch (error) {
    logError('api_error', error, { route: 'PUT /api/solicitudes', mensaje: 'Error al actualizar solicitud' });
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  } finally {
    await closeConnection(connection, 'PUT /api/solicitudes');
  }
}
