import { NextResponse } from 'next/server';
import oracledb from 'oracledb';
import { getConnection } from '@/lib/db';

export async function GET(req) {
  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const usuarioId = searchParams.get('usuarioId');

    if (!usuarioId) {
      return NextResponse.json({ error: 'Falta usuarioId' }, { status: 400 });
    }

    connection = await getConnection();

    // 1. Rutas Publicadas (Como Conductor/Dueño del Viaje)
    const sqlPub = `
      SELECT v.ID_VIA as "id", 
             mo.NOMBRE_MUN as "origen",
             md.NOMBRE_MUN as "destino", 
             TO_CHAR(v.TIEMPO_SALIDA_VIA, 'YYYY-MM-DD') as "fecha", 
             v.VEHICULO_PLACA_VEH as "placa",
             ev.ESTADO_EST_VIA as "estado"
      FROM VIAJES v
      INNER JOIN ESTADOS_VIA ev ON v.ESTADO_VIA_ID_EST_VIA = ev.ID_EST_VIA
      INNER JOIN MUNICIPIOS mo ON v.MUNICIPIO_ORIGEN_ID = mo.ID_MUN
      INNER JOIN MUNICIPIOS md ON v.MUNICIPIOS_DESTINO_ID = md.ID_MUN
      WHERE v.USUARIOS_ID_USU = :usuarioId
    `;
    const resPub = await connection.execute(sqlPub, { usuarioId: Number(usuarioId) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    // 2. Rutas Solicitadas (Como Pasajero)
    const sqlSol = `
      SELECT s.ID_SOL as "id",
             v.ID_VIA as "viajeId",
             mo.NOMBRE_MUN as "origen",
             md.NOMBRE_MUN as "destino",
             TO_CHAR(v.TIEMPO_SALIDA_VIA, 'YYYY-MM-DD') as "fecha",
             u_cond.NOMBRE_USU || ' ' || u_cond.APELLIDO_USU as "conductor",
             es.ESTADO_EST_SOL as "estado",
             v.VEHICULO_PLACA_VEH as "placa",
             m.NOMBRE_MAR as "carro"
      FROM SOLICITUDES s
      JOIN VIAJES v ON s.VIAJES_ID_VIA = v.ID_VIA
      JOIN ESTADOS_SOL es ON s.ESTADO_ID_EST = es.ID_EST_SOL
      JOIN USUARIOS u_cond ON v.USUARIOS_ID_USU = u_cond.ID_USU
      JOIN VEHICULOS vh ON v.VEHICULO_PLACA_VEH = vh.PLACA_VEH
      JOIN MARCAS m ON vh.MARCA_ID_MAR = m.ID_MAR
      JOIN MUNICIPIOS mo ON v.MUNICIPIO_ORIGEN_ID = mo.ID_MUN
      JOIN MUNICIPIOS md ON v.MUNICIPIOS_DESTINO_ID = md.ID_MUN
      WHERE s.USUARIOS_ID_USU = :usuarioId
    `;
    const resSol = await connection.execute(sqlSol, { usuarioId: Number(usuarioId) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

    return NextResponse.json({ 
      publicadas: resPub.rows || [],
      solicitadas: resSol.rows || []
    }, { status: 200 });

  } catch (error) {
    console.error('Error al obtener mis rutas:', error);
    return NextResponse.json({ error: 'Error al obtener rutas' }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}
