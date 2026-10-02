import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { closeConnection } from '@/lib/api/connection';
import { logError, logInfo } from '@/lib/log';
import { enteroPositivo } from '@/lib/domain/validadores';
import { authorize } from '@/lib/auth/guard';
import { requireSelf } from '@/lib/auth/ownership';
import { unirChats } from '@/lib/domain/mensajes';

export async function GET(req) {
  const denied = await authorize(req);
  if (denied) return denied;

  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const usuarioId = searchParams.get('usuarioId');

    if (!usuarioId) {
      return NextResponse.json({ error: 'ID de usuario es requerido' }, { status: 400 });
    }
    if (!enteroPositivo(usuarioId)) {
      return NextResponse.json({ error: 'usuarioId inválido' }, { status: 400 });
    }

    const notOwner = await requireSelf(req, usuarioId);
    if (notOwner) return notOwner;

    connection = await getConnection();

    // Chats de viaje:
    // - Si el usuario es pasajero, trae la info del conductor
    // - Si el usuario es conductor, trae la info del pasajero
    // Solo solicitudes con estado Aceptada (ESTADO_ID_EST = 2), hasta que termina el día del viaje
    const sqlViajes = `
      SELECT s.ID_SOL as "chatId",
             CASE
               WHEN s.USUARIOS_ID_USU = :usuarioId THEN u_cond.NOMBRE_USU || ' ' || u_cond.APELLIDO_USU
               ELSE u_pasajero.NOMBRE_USU || ' ' || u_pasajero.APELLIDO_USU
             END as "nombre",
             mo.NOMBRE_MUN || ' - ' || md.NOMBRE_MUN as "ruta",
             TO_CHAR(v.TIEMPO_SALIDA_VIA, 'YYYY-MM-DD') as "fecha"
      FROM SOLICITUDES s
      JOIN VIAJES v ON s.VIAJES_ID_VIA = v.ID_VIA
      JOIN USUARIOS u_cond ON v.USUARIOS_ID_USU = u_cond.ID_USU
      JOIN USUARIOS u_pasajero ON s.USUARIOS_ID_USU = u_pasajero.ID_USU
      JOIN MUNICIPIOS mo ON v.MUNICIPIO_ORIGEN_ID = mo.ID_MUN
      JOIN MUNICIPIOS md ON v.MUNICIPIOS_DESTINO_ID = md.ID_MUN
      WHERE s.ESTADO_ID_EST = 2
        AND (s.USUARIOS_ID_USU = :usuarioId OR v.USUARIOS_ID_USU = :usuarioId)
        AND CAST(v.TIEMPO_SALIDA_VIA AS DATE) >= CURRENT_DATE
      ORDER BY s.ID_SOL DESC
    `;

    // Chats de guardián, solo el día en que se activó: el usuario protegido ve a su contacto
    // y el contacto ve a quien cuida. Los guardianes anteriores al script 05 no tienen chat
    const sqlGuardianes = `
      SELECT g.ID_GUA as "guardianId",
             CASE
               WHEN g.USUARIO_ID_USU = :usuarioId THEN u_con.NOMBRE_USU || ' ' || u_con.APELLIDO_USU
               ELSE u_pro.NOMBRE_USU || ' ' || u_pro.APELLIDO_USU
             END as "nombre",
             mo.NOMBRE_MUN || ' - ' || md.NOMBRE_MUN as "ruta",
             TO_CHAR(g.FECHA_INICIO_GUA, 'YYYY-MM-DD') as "fecha"
      FROM GUARDIANES g
      JOIN USUARIOS u_pro ON g.USUARIO_ID_USU = u_pro.ID_USU
      JOIN USUARIOS u_con ON g.CONTACTO_ID_USU = u_con.ID_USU
      JOIN VIAJES v ON g.VIAJES_ID_VIA = v.ID_VIA
      JOIN MUNICIPIOS mo ON v.MUNICIPIO_ORIGEN_ID = mo.ID_MUN
      JOIN MUNICIPIOS md ON v.MUNICIPIOS_DESTINO_ID = md.ID_MUN
      WHERE (g.USUARIO_ID_USU = :usuarioId OR g.CONTACTO_ID_USU = :usuarioId)
        AND CAST(g.FECHA_INICIO_GUA AS DATE) = CURRENT_DATE
      ORDER BY g.ID_GUA DESC
    `;

    // Convertir a número para comparar con las columnas BIGINT
    const binds = { usuarioId: Number(usuarioId) };
    const viajes = (await connection.execute(sqlViajes, binds)).rows ?? [];
    const guardianes = (await connection.execute(sqlGuardianes, binds)).rows ?? [];
    const chats = unirChats(viajes, guardianes);
    logInfo('chats_consultados', { route: 'GET /api/mensajes/chats', usuarioId, total: chats.length });
    return NextResponse.json(chats, { status: 200 });
  } catch (error) {
    logError('api_error', error, { route: 'GET /api/mensajes/chats', mensaje: 'Error al obtener chats' });
    return NextResponse.json({ error: 'Error al obtener chats' }, { status: 500 });
  } finally {
    await closeConnection(connection, 'GET /api/mensajes/chats');
  }
}
