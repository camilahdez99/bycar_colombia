import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function GET(req) {
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
    console.error('Error al obtener mensajes:', error);
    return NextResponse.json({ error: 'Error al obtener mensajes' }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}

export async function POST(req) {
  let connection;
  try {
    const { chatId, senderId, text } = await req.json();

    if (!chatId || !senderId || !text) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
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
      return NextResponse.json({ error: 'Chat no encontrado' }, { status: 404 });
    }

    const { passengerId, driverId } = resSol.rows[0];

    const emisorId = parseInt(senderId, 10);
    const receptorId = (emisorId === parseInt(passengerId, 10)) ? parseInt(driverId, 10) : parseInt(passengerId, 10);

    // 2. Insertar mensaje
    const idMen = Date.now();

    const sqlInsert = `
      INSERT INTO MENSAJES (ID_MEN, CONTENIDO_MEN, FECHA_ENVIO_MEN, USUARIO_RECEPTOR_ID, USUARIOS_EMISOR_ID)
      VALUES (:idMen, :contenido, SYSTIMESTAMP, :receptorId, :emisorId)
    `;

    await connection.execute(sqlInsert, { idMen, contenido: text, receptorId, emisorId }, { autoCommit: true });

    return NextResponse.json({ success: true }, { status: 201 });

  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}
