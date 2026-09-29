import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function POST(req) {
  let connection;
  try {
    const { viajeId, usuarioId } = await req.json();

    if (!viajeId || !usuarioId) {
      return NextResponse.json({ error: 'ID de viaje y usuario son requeridos' }, { status: 400 });
    }

    connection = await getConnection();
    const idSol = Date.now();
    
    const sql = `
      INSERT INTO SOLICITUDES (ID_SOL, FECHA_SOL, ESTADO_ID_EST, VIAJES_ID_VIA, USUARIOS_ID_USU)
      VALUES (:idSol, SYSDATE, 1, :viajeId, :usuarioId)
    `;

    await connection.execute(sql, { idSol, viajeId, usuarioId }, { autoCommit: true });

    return NextResponse.json({ message: 'Solicitud enviada', id: idSol }, { status: 201 });
  } catch (error) {
    console.error('Error al solicitar viaje:', error);
    return NextResponse.json({ error: 'Error interno del servidor al crear solicitud' }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}

export async function PUT(req) {
  let connection;
  try {
    const { solicitudId, estado } = await req.json();

    if (!solicitudId || !estado) {
      return NextResponse.json({ error: 'ID de solicitud y estado son requeridos' }, { status: 400 });
    }

    connection = await getConnection();

    // Mapa directo de texto → ID de estado (según ESTADOS_SOL)
    const estadoMap = {
      'Pendiente': 1,
      'Aceptado': 2,
      'Aceptada': 2,
      'Rechazado': 3,
      'Rechazada': 3,
      'Cancelado': 4,
      'Cancelada': 4,
    };

    const estadoId = isNaN(estado)
      ? (estadoMap[estado] ?? null)
      : Number(estado);

    if (!estadoId) {
      return NextResponse.json({ error: `Estado desconocido: ${estado}` }, { status: 400 });
    }

    const sql = `UPDATE SOLICITUDES SET ESTADO_ID_EST = :estadoId WHERE ID_SOL = :solicitudId`;
    const result = await connection.execute(
      sql,
      { estadoId: Number(estadoId), solicitudId: Number(solicitudId) },
      { autoCommit: true }
    );
    console.log(`[PUT /solicitudes] id=${solicitudId} → estadoId=${estadoId}, filas afectadas=${result.rowsAffected}`);

    return NextResponse.json({ message: 'Solicitud actualizada' }, { status: 200 });
  } catch (error) {
    console.error('Error al actualizar solicitud:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}
