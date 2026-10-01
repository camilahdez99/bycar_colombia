import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { closeConnection } from '@/lib/api/connection';
import { logError } from '@/lib/log';
import { enteroPositivo } from '@/lib/domain/validadores';
import { authorize } from '@/lib/auth/guard';
import { requireSelf } from '@/lib/auth/ownership';

export async function GET(req) {
  const denied = await authorize(req);
  if (denied) return denied;

  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const usuarioId = searchParams.get('usuarioId');

    if (!usuarioId) {
      return NextResponse.json({ error: 'Falta usuarioId' }, { status: 400 });
    }
    if (!enteroPositivo(usuarioId)) {
      return NextResponse.json({ error: 'usuarioId inválido' }, { status: 400 });
    }

    const notOwner = await requireSelf(req, usuarioId);
    if (notOwner) return notOwner;

    connection = await getConnection();
    const sql = `
      SELECT s.ID_SOL as "id", 
             u.NOMBRE_USU || ' ' || u.APELLIDO_USU as "pasajero", 
             mo.NOMBRE_MUN || ' -> ' || md.NOMBRE_MUN as "ruta",
             'U' as "avatar"
      FROM SOLICITUDES s
      JOIN VIAJES v ON s.VIAJES_ID_VIA = v.ID_VIA
      JOIN USUARIOS u ON s.USUARIOS_ID_USU = u.ID_USU
      JOIN MUNICIPIOS mo ON v.MUNICIPIO_ORIGEN_ID = mo.ID_MUN
      JOIN MUNICIPIOS md ON v.MUNICIPIOS_DESTINO_ID = md.ID_MUN
      WHERE s.ESTADO_ID_EST = 1 
        AND v.USUARIOS_ID_USU = :usuarioId
    `;
    
    // Convertir usuarioId a número para asegurar compatibilidad en Oracle
    const result = await connection.execute(sql, { usuarioId: Number(usuarioId) });
    
    const solicitudes = result.rows || [];
    return NextResponse.json(solicitudes, { status: 200 });
  } catch (error) {
    logError('api_error', error, { route: 'GET /api/solicitudes/recibidas', mensaje: 'Error al obtener solicitudes' });
    return NextResponse.json({ error: 'Error al obtener solicitudes' }, { status: 500 });
  } finally {
    await closeConnection(connection, 'GET /api/solicitudes/recibidas');
  }
}
