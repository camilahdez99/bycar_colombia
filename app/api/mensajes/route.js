import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { closeConnection } from '@/lib/api/connection';
import { logError } from '@/lib/log';
import { enteroPositivo, textoNoVacio } from '@/lib/domain/validadores';
import { JSON_INVALIDO, invalidJsonResponse, readJson } from '@/lib/api/validacion';
import { authorize } from '@/lib/auth/guard';
import { checkOwnership, requireSelf, sameUser } from '@/lib/auth/ownership';
import { calcularParticipantesMensaje } from '@/lib/domain/mensajes';

/*
 * Un chat es una solicitud aceptada (pasajero y conductor, `chatId` = ID_SOL) o un guardián
 * (usuario protegido y su contacto de confianza, `guardianId` = ID_GUA). Cada mensaje guarda
 * su chat: antes se filtraban por par de usuarios y dos viajes compartían historial (BUGS F4).
 * El chat de un viaje se ve hasta que termina el día del viaje y el de un guardián, el día en
 * que se activó. Después la consulta no lo encuentra: queda oculto, no se borra.
 */
const CHATS = {
  solicitud: {
    participantes: `
      SELECT s.USUARIOS_ID_USU as "passengerId", v.USUARIOS_ID_USU as "driverId"
      FROM SOLICITUDES s
      JOIN VIAJES v ON s.VIAJES_ID_VIA = v.ID_VIA
      WHERE s.ID_SOL = :chatId
        AND CAST(v.TIEMPO_SALIDA_VIA AS DATE) >= CURRENT_DATE
    `,
    mensajes: `
      SELECT CONTENIDO_MEN as "content", USUARIOS_EMISOR_ID as "senderId"
      FROM MENSAJES
      WHERE SOLICITUD_ID_SOL = :chatId
      ORDER BY FECHA_ENVIO_MEN ASC
    `,
  },
  guardian: {
    // Guardianes anteriores al script 05 no tienen USUARIO_ID_USU: no tienen chat
    participantes: `
      SELECT g.USUARIO_ID_USU as "passengerId", g.CONTACTO_ID_USU as "driverId"
      FROM GUARDIANES g
      WHERE g.ID_GUA = :chatId
        AND g.USUARIO_ID_USU IS NOT NULL
        AND g.CONTACTO_ID_USU IS NOT NULL
        AND CAST(g.FECHA_INICIO_GUA AS DATE) = CURRENT_DATE
    `,
    mensajes: `
      SELECT CONTENIDO_MEN as "content", USUARIOS_EMISOR_ID as "senderId"
      FROM MENSAJES
      WHERE GUARDIAN_ID_GUA = :chatId
      ORDER BY FECHA_ENVIO_MEN ASC
    `,
  },
};

// En los dos tipos de chat participan exactamente dos usuarios
const isParticipant = (userId, passengerId, driverId) =>
  sameUser(userId, passengerId) || sameUser(userId, driverId);

const CHAT_AMBIGUO = 'Indica chatId o guardianId, no ambos';

/** { tipo, id } del chat pedido, o { error } si falta, sobra o es inválido. */
function chatPedido(chatId, guardianId) {
  if (chatId && guardianId) return { error: CHAT_AMBIGUO };
  if (!chatId && !guardianId) return { error: 'Falta chatId' };
  const id = guardianId || chatId;
  if (!enteroPositivo(id)) return { error: guardianId ? 'guardianId inválido' : 'chatId inválido' };
  return { tipo: guardianId ? 'guardian' : 'solicitud', id };
}

const badRequest = (error) => NextResponse.json({ error }, { status: 400 });

export async function GET(req) {
  const denied = await authorize(req);
  if (denied) return denied;

  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const chat = chatPedido(searchParams.get('chatId'), searchParams.get('guardianId'));
    if (chat.error) return badRequest(chat.error);

    connection = await getConnection();

    // 1. Participantes del chat
    const resChat = await connection.execute(CHATS[chat.tipo].participantes, { chatId: chat.id });

    if (!resChat.rows?.length) {
      return NextResponse.json([], { status: 200 });
    }

    const { passengerId, driverId } = resChat.rows[0];

    const notParticipant = await checkOwnership(req, (userId) => isParticipant(userId, passengerId, driverId));
    if (notParticipant) return notParticipant;

    // 2. Mensajes del chat
    const resMsgs = await connection.execute(CHATS[chat.tipo].mensajes, { chatId: chat.id });

    const messages = (resMsgs.rows || []).map(row => ({
      senderId: row.senderId,
      text: row.content || ''
    }));

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
    const body = await readJson(req);
    if (body === JSON_INVALIDO) return invalidJsonResponse();
    const { chatId, guardianId, senderId, text } = body ?? {};

    if ((!chatId && !guardianId) || !senderId || !text) {
      return badRequest('Datos incompletos');
    }
    if (chatId && guardianId) return badRequest(CHAT_AMBIGUO);
    const chat = chatPedido(chatId, guardianId);
    if (chat.error || !enteroPositivo(senderId) || !textoNoVacio(text)) {
      return badRequest('Datos inválidos');
    }

    const notSender = await requireSelf(req, senderId);
    if (notSender) return notSender;

    connection = await getConnection();

    // 1. Participantes del chat
    const resChat = await connection.execute(CHATS[chat.tipo].participantes, { chatId: chat.id });

    if (!resChat.rows?.length) {
      return NextResponse.json({ error: 'Chat no encontrado' }, { status: 404 });
    }

    const { passengerId, driverId } = resChat.rows[0];

    const notParticipant = await checkOwnership(req, (userId) => isParticipant(userId, passengerId, driverId));
    if (notParticipant) return notParticipant;

    const { emisorId, receptorId } = calcularParticipantesMensaje(senderId, passengerId, driverId);

    // 2. Insertar el mensaje en su chat
    const idMen = Date.now();

    const sqlInsert = `
      INSERT INTO MENSAJES (ID_MEN, CONTENIDO_MEN, FECHA_ENVIO_MEN, USUARIO_RECEPTOR_ID, USUARIOS_EMISOR_ID, SOLICITUD_ID_SOL, GUARDIAN_ID_GUA)
      VALUES (:idMen, :contenido, CURRENT_TIMESTAMP, :receptorId, :emisorId, :solicitudId, :guardianId)
    `;

    await connection.execute(sqlInsert, {
      idMen,
      contenido: text,
      receptorId,
      emisorId,
      solicitudId: chat.tipo === 'solicitud' ? Number(chat.id) : null,
      guardianId: chat.tipo === 'guardian' ? Number(chat.id) : null,
    }, { autoCommit: true });

    return NextResponse.json({ success: true }, { status: 201 });

  } catch (error) {
    logError('api_error', error, { route: 'POST /api/mensajes', mensaje: 'Error al enviar mensaje' });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  } finally {
    await closeConnection(connection, 'POST /api/mensajes');
  }
}
