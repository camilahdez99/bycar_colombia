import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { closeConnection } from '@/lib/api/connection';
import { logError } from '@/lib/log';
import { authorize } from '@/lib/auth/guard';
import { checkOwnership, requireSelf, sameUser } from '@/lib/auth/ownership';
import { calcularParticipantesMensaje } from '@/lib/domain/mensajes';

// El chat es una solicitud: solo su pasajero y el conductor del viaje participan
const isParticipant = (userId, passengerId, driverId) =>
  sameUser(userId, passengerId) || sameUser(userId, driverId);

export async function GET(req) {
  const denied = await authorize(req);
  if (denied) return denied;

  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId'); // Esto es el ID_SOL

    if (!chatId) {
      return NextResponse.json({ error: 'Falta chatId' }, { status: 400 });
    }

    connection = await getConnection();

    // 1. Obtener passengerId y driverId de la Solicitud
    const sqlSol = `
      SELECT s.USUARIOS_ID_USU as "passengerId", v.USUARIOS_ID_USU as "driverId"
      FROM SOLICITUDES s
      JOIN VIAJES v ON s.VIAJES_ID_VIA = v.ID_VIA
      WHERE s.ID_SOL = :chatId
    `;
    const resSol = await connection.execute(sqlSol, { chatId });
    
    if (resSol.rows.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    const { passengerId, driverId } = resSol.rows[0];

    const notParticipant = await checkOwnership(req, (userId) => isParticipant(userId, passengerId, driverId));
    if (notParticipant) return notParticipant;

    // 2. Obtener mensajes asociados a este par
    const sqlMsgs = `
      SELECT TO_CHAR(CONTENIDO_MEN) as "content", USUARIOS_EMISOR_ID as "senderId"
      FROM MENSAJES
      WHERE (USUARIO_RECEPTOR_ID = :passengerId AND USUARIOS_EMISOR_ID = :driverId)
         OR (USUARIO_RECEPTOR_ID = :driverId AND USUARIOS_EMISOR_ID = :passengerId)
      ORDER BY FECHA_ENVIO_MEN ASC
    `;
    const resMsgs = await connection.execute(sqlMsgs, { passengerId, driverId });

    // 3. Transformar mensajes
    const messages = (resMsgs.rows || []).map(row => {
      return {
        senderId: row.senderId,
        text: row.content || ''
      };
    });

    return NextResponse.json(messages, { status: 200 });

  } catch (error) {
    logError('api_error', error, { route: 'GET /api/mensajes', mensaje: 'Error al obtener mensajes' });
    return NextResponse.json({ error: 'Error al obtener mensajes' }, { status: 500 });
  } finally {
    await closeConnection(connection, 'GET /api/mensajes');
  }
}

export async function POST(req) {
  const denied = await authorize(req);
  if (denied) return denied;

  let connection;
  try {
    const { chatId, senderId, text } = await req.json();

    if (!chatId || !senderId || !text) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const notSender = await requireSelf(req, senderId);
    if (notSender) return notSender;

    connection = await getConnection();

    // 1. Obtener passengerId y driverId de la Solicitud
    const sqlSol = `
      SELECT s.USUARIOS_ID_USU as "passengerId", v.USUARIOS_ID_USU as "driverId"
      FROM SOLICITUDES s
      JOIN VIAJES v ON s.VIAJES_ID_VIA = v.ID_VIA
      WHERE s.ID_SOL = :chatId
    `;
    const resSol = await connection.execute(sqlSol, { chatId });
    
    if (resSol.rows.length === 0) {
      return NextResponse.json({ error: 'Chat no encontrado' }, { status: 404 });
    }

    const { passengerId, driverId } = resSol.rows[0];

    const notParticipant = await checkOwnership(req, (userId) => isParticipant(userId, passengerId, driverId));
    if (notParticipant) return notParticipant;

    const { emisorId, receptorId } = calcularParticipantesMensaje(senderId, passengerId, driverId);

    // 2. Insertar mensaje
    const idMen = Date.now();

    const sqlInsert = `
      INSERT INTO MENSAJES (ID_MEN, CONTENIDO_MEN, FECHA_ENVIO_MEN, USUARIO_RECEPTOR_ID, USUARIOS_EMISOR_ID)
      VALUES (:idMen, :contenido, SYSTIMESTAMP, :receptorId, :emisorId)
    `;

    await connection.execute(sqlInsert, { idMen, contenido: text, receptorId, emisorId }, { autoCommit: true });

    return NextResponse.json({ success: true }, { status: 201 });

  } catch (error) {
    logError('api_error', error, { route: 'POST /api/mensajes', mensaje: 'Error al enviar mensaje' });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  } finally {
    await closeConnection(connection, 'POST /api/mensajes');
  }
}
