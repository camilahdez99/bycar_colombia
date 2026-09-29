import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function GET(req) {
  let connection;
  try {
    connection = await getConnection();
    const sql = `
      SELECT v.ID_VIA as "id", 
             mo.NOMBRE_MUN || ' - ' || md.NOMBRE_MUN as "ruta", 
             TO_CHAR(v.TIEMPO_SALIDA_VIA, 'YYYY-MM-DD') as "fecha", 
             ev.ESTADO_EST_VIA as "estado",
             u.NOMBRE_USU || ' ' || u.APELLIDO_USU as "conductor",
             (SELECT LISTAGG(u2.NOMBRE_USU || ' ' || u2.APELLIDO_USU, ', ') WITHIN GROUP (ORDER BY u2.NOMBRE_USU)
              FROM SOLICITUDES s 
              JOIN USUARIOS u2 ON s.USUARIOS_ID_USU = u2.ID_USU 
              WHERE s.VIAJES_ID_VIA = v.ID_VIA AND s.ESTADO_ID_EST = 2) as "pasajeros"
      FROM VIAJES v
      JOIN USUARIOS u ON v.USUARIOS_ID_USU = u.ID_USU
      JOIN ESTADOS_VIA ev ON v.ESTADO_VIA_ID_EST_VIA = ev.ID_EST_VIA
      JOIN MUNICIPIOS mo ON v.MUNICIPIO_ORIGEN_ID = mo.ID_MUN
      JOIN MUNICIPIOS md ON v.MUNICIPIOS_DESTINO_ID = md.ID_MUN
    `;
    const result = await connection.execute(sql);
    return NextResponse.json(result.rows || [], { status: 200 });
  } catch (error) {
    console.error('Error al obtener viajes admin:', error);
    return NextResponse.json({ error: 'Error al obtener viajes' }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}

export async function DELETE(req) {
  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    connection = await getConnection();
    
    // ON DELETE CASCADE se encarga de las dependencias
    const sql = `DELETE FROM VIAJES WHERE ID_VIA = :id`;
    await connection.execute(sql, { id }, { autoCommit: true });

    return NextResponse.json({ message: 'Viaje y sus dependencias eliminados' }, { status: 200 });
  } catch (error) {
    console.error('Error al eliminar viaje:', error);
    return NextResponse.json({ error: 'Error al eliminar viaje: ' + error.message }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}

export async function PUT(req) {
  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const { estado } = await req.json();

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    connection = await getConnection();
    let sql;
    let binds = { id };

    if (isNaN(estado)) {
      // Si el estado es un texto, buscar dinámicamente el ID en la BD
      sql = `
        UPDATE VIAJES 
        SET ESTADO_VIA_ID_EST_VIA = (
          SELECT ID_EST_VIA 
          FROM ESTADOS_VIA 
          WHERE UPPER(SUBSTR(ESTADO_EST_VIA, 1, 6)) = UPPER(SUBSTR(:estadoStr, 1, 6))
          AND ROWNUM = 1
        )
        WHERE ID_VIA = :id
      `;
      binds.estadoStr = estado;
    } else {
      sql = `UPDATE VIAJES SET ESTADO_VIA_ID_EST_VIA = :estadoId WHERE ID_VIA = :id`;
      binds.estadoId = Number(estado);
    }

    await connection.execute(sql, binds, { autoCommit: true });

    return NextResponse.json({ message: 'Viaje actualizado' }, { status: 200 });
  } catch (error) {
    console.error('Error al actualizar viaje:', error);
    return NextResponse.json({ error: 'Error al actualizar viaje' }, { status: 500 });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}
